# backend/app/services/ai.py
import os
import json
import re
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.question import QuestionType
from app.services.embedding import EmbeddingService, DocumentChunk
from app.config import settings

class AIService:
    def __init__(self):
        # Initialize the Gemini API
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        self.model = genai.GenerativeModel('gemini-1.5-pro')
        self.embedding_service = EmbeddingService()
        
        # Detailed system prompt for quiz generation
        self.default_quiz_prompt = """
            Your task is to generate a comprehensive quiz based on the provided topic or document content. 
            Follow these guidelines carefully:

            1. Question Generation Rules:
            - Generate clear, specific questions with detailed question text (not just "Question 1")
            - Create questions directly related to the topic
            - Ensure questions test comprehension and critical thinking
            - Mix difficulty levels (easy, medium, challenging)
            - IMPORTANT: Your questions must be directly based on the provided document content, 
              don't make up facts not present in the documents.

            2. Question Type Distribution:
            - 20% of questions should be boolean (true/false) type
            - 80% of questions should be multiple-choice with 3-6 options
            - Ensure ONE and only ONE correct answer per question

            3. JSON Output Structure:
            Respond with a VALID JSON array with this exact structure:
            [{
                "question_text": "Quizz ready text of the question",
                "question_type": "boolean" or "multiple_choice",
                "explanation": "Quizz ready concise explanation of the correct answer",
                "position": 0-based question index,
                "answers": [
                    {
                        "answer_text": "Quizz ready full text of the answer to the generated question text",
                        "is_correct": true or false,
                        "position": 0-based answer index
                    }
                ]
            }]

            4. Special Instructions:
            - If document content is provided, base questions primarily on that content
            - If only a topic is given, generate general knowledge questions about that topic
            - For boolean questions, ensure the statements are clear and unambiguous
            - For multiple-choice questions, make all options relevant to the question
            - Provide informative explanations that teach the concept
            - Do not respond with option A, option B and so on
            """
    
    async def generate_quiz(
        self,
        db: Session,
        topic: str,
        num_questions: int = 10,
        document_ids: Optional[List[int]] = None,
        custom_prompt: Optional[str] = None,
        use_embeddings: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Generate quiz questions using Gemini AI based on a topic or documents
        """
        # Prepare content from documents if provided
        document_content = ""
        document_sources = []
        relevant_chunks_info = []
        
        if document_ids:
            # If using embeddings, find the most relevant chunks
            if use_embeddings:
                # Check if any of the documents have embeddings
                chunk_count = db.query(DocumentChunk).filter(
                    DocumentChunk.document_id.in_(document_ids)
                ).count()
                
                # Only use embeddings if they exist
                if chunk_count > 0:
                    relevant_chunks = await self.embedding_service.find_relevant_chunks(
                        db=db,
                        query=topic,
                        top_k=15,  # Retrieve more chunks for better coverage
                        document_ids=document_ids
                    )
                    
                    if relevant_chunks:
                        # Sort documents by similarity score
                        relevant_chunks.sort(key=lambda x: x["similarity"], reverse=True)
                        
                        # Store info about the chunks for response metadata
                        for chunk in relevant_chunks:
                            doc = db.query(Document).filter(Document.id == chunk["document_id"]).first()
                            if doc:
                                document_content += f"\n\n--- Content from {doc.filename} (relevance: {chunk['similarity']:.2f}) ---\n{chunk['text']}"
                                
                                # Add to relevant chunks info
                                relevant_chunks_info.append({
                                    "document_id": doc.id,
                                    "document_name": doc.filename,
                                    "chunk_text": chunk["text"][:100] + "...",
                                    "similarity": chunk["similarity"]
                                })
                                
                                # Keep track of source documents
                                if {"id": doc.id, "filename": doc.filename, "type": doc.file_type} not in document_sources:
                                    document_sources.append({"id": doc.id, "filename": doc.filename, "type": doc.file_type})
            
            # Fallback to using full documents if no chunks found or not using embeddings
            if not document_content:
                documents = db.query(Document).filter(Document.id.in_(document_ids)).all()
                for doc in documents:
                    # Extract most important content
                    extracted_content = self._extract_important_content(doc.content, max_length=8000)
                    document_content += f"\n\n--- Content from {doc.filename} ---\n{extracted_content}"
                    document_sources.append({"id": doc.id, "filename": doc.filename, "type": doc.file_type})
        
        # Build the final prompt
        system_prompt = custom_prompt or self.default_quiz_prompt
        
        # Enhanced prompt with focus on document content
        prompt = f"{system_prompt}\n\n"
        prompt += f"Topic: {topic}\n"
        prompt += f"Number of questions: {num_questions}\n\n"
        
        if document_content:
            # Add indicator for content source to help answer generation
            prompt += "IMPORTANT: The following document content MUST be the primary source for generating quiz questions.\n"
            prompt += "Use this content to create specific, accurate questions and do not introduce facts not present in these documents.\n\n"
            
            # Truncate if too large to fit in context window
            max_content_length = 65000  # Adjusted for Gemini's limits
            if len(document_content) > max_content_length:
                document_content = document_content[:max_content_length] + "..."
            
            prompt += f"Document Content:\n{document_content}\n\n"
        
        prompt += "Respond ONLY with a valid JSON array of questions."
        
        try:
            # Generate content
            response = await self._generate_content(prompt)
            
            # Parse and validate the response
            questions_data = self._extract_and_parse_json(response)
            
            # If extraction failed, try one more time with a simplified prompt
            if not questions_data or not isinstance(questions_data, list):
                simplified_prompt = f"""
                Create {num_questions} quiz questions about {topic} based on the provided document content.
                Mix of multiple choice (80%) and true/false (20%) questions.
                
                Respond with a JSON array of questions following this format:
                [{{"question_text": "", "question_type": "multiple_choice", "explanation": "", "position": 0, "answers": [
                    {{"answer_text": "", "is_correct": true, "position": 0}}, 
                    {{"answer_text": "", "is_correct": false, "position": 1}}
                ]}}]
                
                Document content:
                {document_content[:30000] if document_content else 'No specific content provided, use general knowledge.'}
                """
                
                response = await self._generate_content(simplified_prompt)
                questions_data = self._extract_and_parse_json(response)
            
            # Validate and fix questions
            validated_questions = self._validate_and_fix_questions(questions_data, num_questions)
            
            # Add metadata about document sources if used
            for question in validated_questions:
                question["document_sources"] = document_sources
                
                # If using embeddings, add relevant chunk info to questions
                if use_embeddings and relevant_chunks_info:
                    question["relevant_chunks"] = relevant_chunks_info
            
            return validated_questions
            
        except Exception as e:
            print(f"Error generating quiz: {str(e)}")
            return []
    
    def _extract_important_content(self, text: str, max_length: int = 8000) -> str:
        """
        Extract the most important content from a document to fit within context window
        Uses heuristics to focus on structured and information-rich sections
        """
        if len(text) <= max_length:
            return text
        
        # Split into paragraphs
        paragraphs = text.split('\n\n')
        
        # Score each paragraph for importance
        scored_paragraphs = []
        for p in paragraphs:
            if not p.strip():
                continue
            
            # Calculate score based on heuristics
            score = 0
            
            # Higher score for paragraphs with titles/headers
            if re.match(r'^#+\s+', p) or p.isupper() or p.endswith(':'):
                score += 10
            
            # Higher score for paragraphs with numbers (likely important data)
            if re.search(r'\d+', p):
                score += 5
            
            # Higher score for longer paragraphs (likely more content)
            score += min(len(p.split()) / 10, 5)
            
            # Higher score for paragraphs with keywords (customize based on domain)
            important_keywords = ['important', 'key', 'significant', 'critical', 'essential',
                                 'summary', 'conclusion', 'result', 'finding']
            for keyword in important_keywords:
                if keyword in p.lower():
                    score += 3
            
            # Higher score for structured content (lists, etc.)
            if re.search(r'^\s*[-*•]\s+', p, re.MULTILINE):
                score += 5
            
            scored_paragraphs.append((p, score))
        
        # Sort by score (descending)
        scored_paragraphs.sort(key=lambda x: x[1], reverse=True)
        
        # Select paragraphs until we reach max_length
        selected_paragraphs = []
        current_length = 0
        
        # Always include first paragraph (introductory)
        if paragraphs and paragraphs[0].strip():
            intro = paragraphs[0]
            selected_paragraphs.append(intro)
            current_length += len(intro) + 2  # +2 for newlines
        
        for p, score in scored_paragraphs:
            if p in selected_paragraphs:
                continue
                
            if current_length + len(p) + 2 <= max_length:
                selected_paragraphs.append(p)
                current_length += len(p) + 2
            else:
                # If we can't fit the whole paragraph, check if we can fit a summary
                if len(p) > 100:
                    summary = p[:97] + "..."
                    remaining_space = max_length - current_length
                    if len(summary) <= remaining_space:
                        selected_paragraphs.append(summary)
                        current_length += len(summary) + 2
                        
                # Break if we're close to the limit
                if current_length >= max_length * 0.95:
                    break
        
        # If we still have space, try to include conclusion paragraphs
        if current_length < max_length * 0.9 and len(paragraphs) > 5:
            conclusion_candidates = paragraphs[-3:]  # Last 3 paragraphs
            for p in conclusion_candidates:
                if p not in selected_paragraphs:
                    if current_length + len(p) + 2 <= max_length:
                        selected_paragraphs.append(p)
                        current_length += len(p) + 2
        
        # Return the selected content
        return '\n\n'.join(selected_paragraphs)
    
    async def regenerate_question(
        self,
        topic: str,
        question_index: int,
        question_type: str,
        custom_prompt: Optional[str] = None,
        document_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Regenerate a single question
        """
        system_prompt = custom_prompt or self.default_quiz_prompt
        
        prompt = f"""
        {system_prompt}
        
        Regenerate a single quiz question with these specifications:
        Topic: {topic}
        Question Number: {question_index}
        Question Type: {question_type}
        """
        
        # Add document content if provided
        if document_content:
            prompt += f"\n\nUse the following document content as your source:\n{document_content}\n"
        
        prompt += "\nRespond ONLY with a valid JSON object for the question."
        
        try:
            response = await self._generate_content(prompt)
            question_data = self._extract_and_parse_json(response)
            
            # If we got a list, take the first item
            if isinstance(question_data, list) and len(question_data) > 0:
                question_data = question_data[0]
            
            # Validate and fix the question
            if question_data:
                question_data = self._validate_question(question_data, question_index)
                return question_data
            
            return None
            
        except Exception as e:
            print(f"Error regenerating question: {str(e)}")
            return None
    
    async def change_question_type(
        self,
        question_data: Dict[str, Any],
        new_type: str,
        topic: str,
        custom_prompt: Optional[str] = None,
        document_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Change a question's type (boolean/multiple choice) and regenerate appropriate answers
        """
        if new_type not in ["boolean", "multiple_choice"]:
            raise ValueError("Question type must be 'boolean' or 'multiple_choice'")
            
        system_prompt = custom_prompt or self.default_quiz_prompt
        
        prompt = f"""
        {system_prompt}
        
        I have this quiz question on the topic "{topic}":
        "{question_data['question_text']}"
        
        Convert it to a {new_type} question. Keep the original question text as similar as possible.
        For boolean, provide True/False options with exactly one correct answer.
        For multiple choice, provide 4 options with exactly one correct answer.
        Include a brief explanation of the correct answer.
        """
        
        # Add document content if provided
        if document_content:
            prompt += f"\n\nUse the following document content as your source:\n{document_content}\n"
        
        prompt += "\nRespond ONLY with a valid JSON object."
        
        try:
            response = await self._generate_content(prompt)
            new_question_data = self._extract_and_parse_json(response)
            
            # If we got a list, take the first item
            if isinstance(new_question_data, list) and len(new_question_data) > 0:
                new_question_data = new_question_data[0]
            
            # Validate and fix the question
            if new_question_data:
                # Preserve the position and overwrite question type
                new_question_data["position"] = question_data["position"]
                new_question_data["question_type"] = new_type
                
                # If we didn't get a new question text, keep the original
                if "question_text" not in new_question_data or not new_question_data["question_text"]:
                    new_question_data["question_text"] = question_data["question_text"]
                
                new_question_data = self._validate_question(new_question_data, question_data["position"])
                return new_question_data
            
            # Fallback: manually change the question type and generate default answers
            modified_question = question_data.copy()
            modified_question["question_type"] = new_type
            modified_question["answers"] = self._generate_default_answers(new_type)
            return modified_question
            
        except Exception as e:
            print(f"Error changing question type: {str(e)}")
            # Fallback: manually change the question type and generate default answers
            modified_question = question_data.copy()
            modified_question["question_type"] = new_type
            modified_question["answers"] = self._generate_default_answers(new_type)
            return modified_question
    
    async def _generate_content(self, prompt: str) -> str:
        """
        Generate content using Gemini
        """
        try:
            response = await self.model.generate_content_async(prompt)
            return response.text
        except Exception as e:
            print(f"Gemini API error: {str(e)}")
            return ""
    
    def _extract_and_parse_json(self, response: str) -> Any:
        """
        Extract and parse JSON from the response text
        """
        if not response:
            return []
        
        # Try to extract JSON using multiple methods
        try:
            # Method 1: Direct JSON parsing
            return json.loads(response)
        except json.JSONDecodeError:
            pass
        
        # Method 2: Extract JSON from markdown code blocks
        json_pattern = r"```(?:json)?\s*([\s\S]*?)```"
        code_block_matches = re.findall(json_pattern, response)
        
        for match in code_block_matches:
            try:
                return json.loads(match)
            except json.JSONDecodeError:
                continue
        
        # Method 3: Extract JSON-like content between square brackets or braces
        json_pattern = r'\[{[\s\S]*}\]|\[[\s\S]*\]|{[\s\S]*}'
        full_matches = re.findall(json_pattern, response)
        
        for match in full_matches:
            try:
                return json.loads(match)
            except json.JSONDecodeError:
                continue
        
        # Method 4: Attempt to clean and parse
        try:
            # Remove leading/trailing whitespace and potential noise
            cleaned_response = response.strip().replace('\n', '').replace('\r', '')
            return json.loads(cleaned_response)
        except Exception:
            print(f"Could not parse JSON from response: {response[:500]}...")
            return []
    
    def _validate_and_fix_questions(
        self, 
        questions_data: List[Dict[str, Any]], 
        expected_count: int
    ) -> List[Dict[str, Any]]:
        """
        Validate and fix the structure of questions
        """
        # Ensure questions_data is a list
        if not isinstance(questions_data, list):
            questions_data = [questions_data] if isinstance(questions_data, dict) else []
        
        # Ensure we have the right number of questions
        if len(questions_data) > expected_count:
            questions_data = questions_data[:expected_count]
        
        # Validate each question
        valid_questions = []
        for i, question in enumerate(questions_data):
            fixed_question = self._validate_question(question, i)
            if fixed_question:
                valid_questions.append(fixed_question)
        
        # If we don't have enough questions, generate placeholders
        while len(valid_questions) < expected_count:
            placeholder = self._generate_placeholder_question(len(valid_questions))
            valid_questions.append(placeholder)
        
        return valid_questions
    
    def _validate_question(self, question: Dict[str, Any], position: int) -> Dict[str, Any]:
        """
        Validate and fix a single question
        """
        if not isinstance(question, dict):
            return self._generate_placeholder_question(position)
        
        # Ensure required fields
        question.setdefault('question_text', f'Question {position + 1}')
        question.setdefault('explanation', '')
        question.setdefault('position', position)
        
        # Validate question type
        question_type = question.get('question_type', 'multiple_choice').lower()
        question['question_type'] = 'multiple_choice' if question_type not in ['boolean', 'multiple_choice'] else question_type
        
        # Validate answers
        if 'answers' not in question or not isinstance(question['answers'], list):
            question['answers'] = self._generate_default_answers(question['question_type'])
        else:
            # Validate individual answers
            validated_answers = []
            for i, answer in enumerate(question['answers']):
                if not isinstance(answer, dict):
                    answer = {'answer_text': str(answer), 'is_correct': False, 'position': i}
                
                answer.setdefault('answer_text', f'Option {i + 1}')
                answer.setdefault('is_correct', False)
                answer.setdefault('position', i)
                
                validated_answers.append(answer)
            
            # Ensure at least one correct answer
            if not any(a['is_correct'] for a in validated_answers):
                if validated_answers:
                    validated_answers[0]['is_correct'] = True
            
            # For boolean, ensure exactly 2 answers
            if question['question_type'] == 'boolean':
                validated_answers = validated_answers[:2]
                if len(validated_answers) < 2:
                    validated_answers.extend([
                        {'answer_text': 'True', 'is_correct': False, 'position': len(validated_answers)},
                        {'answer_text': 'False', 'is_correct': False, 'position': len(validated_answers) + 1}
                    ])
                # If we have more than 2 answers, keep only 2
                while len(validated_answers) > 2:
                    validated_answers.pop()
            
            # For multiple choice, ensure 4 options
            elif question['question_type'] == 'multiple_choice':
                while len(validated_answers) < 4:
                    validated_answers.append({
                        'answer_text': f'Option {len(validated_answers) + 1}', 
                        'is_correct': False, 
                        'position': len(validated_answers)
                    })
                validated_answers = validated_answers[:4]
            
            question['answers'] = validated_answers
        
        return question
    
    def _generate_default_answers(self, question_type: str) -> List[Dict[str, Any]]:
        """
        Generate default answers based on question type
        """
        if question_type == 'boolean':
            return [
                {'answer_text': 'True', 'is_correct': True, 'position': 0},
                {'answer_text': 'False', 'is_correct': False, 'position': 1}
            ]
        else:  # multiple_choice
            return [
                {'answer_text': 'Option A', 'is_correct': True, 'position': 0},
                {'answer_text': 'Option B', 'is_correct': False, 'position': 1},
                {'answer_text': 'Option C', 'is_correct': False, 'position': 2},
                {'answer_text': 'Option D', 'is_correct': False, 'position': 3}
            ]
    
    def _generate_placeholder_question(self, position: int) -> Dict[str, Any]:
        """
        Generate a placeholder question when validation fails
        """
        return {
            'question_text': f'Default Question {position + 1}',
            'question_type': 'multiple_choice',
            'explanation': 'A placeholder question generated due to AI generation failure.',
            'position': position,
            'answers': self._generate_default_answers('multiple_choice')
        }