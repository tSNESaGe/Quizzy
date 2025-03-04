from typing import Tuple, Dict, Any, Optional, List
import hashlib
from pathlib import Path
from docling.document_converter import DocumentConverter
from docling.chunking import HybridChunker

class DocumentProcessor:
    def __init__(self, upload_folder: str):
        """
        Initialize the document processor with Docling converters and configuration
        
        Args:
            upload_folder (str): Base directory for storing uploaded files
        """
        self.upload_folder = Path(upload_folder)
        self.upload_folder.mkdir(parents=True, exist_ok=True)
        
        # Initialize Docling converters
        self.converter = DocumentConverter()
        self.chunker = HybridChunker(
            min_words_per_chunk=30,
            max_words_per_chunk=150,
            overlap=5
        )
    
    def process_document(self, filename: str, file_content: bytes) -> Dict[str, Any]:
        """
        Process an uploaded document using Docling
        
        Args:
            filename (str): Original filename
            file_content (bytes): File content as bytes
        
        Returns:
            Dict containing document metadata and processed content
        """
        # Calculate file hashes
        file_hash = self._calculate_file_hash(file_content)
        
        # Determine file type
        file_type = self._get_file_type(filename)
        
        # Create a unique filename for storage
        storage_filename = self._generate_unique_filename(filename, file_hash)
        
        # Store the raw file
        full_path = self.upload_folder / storage_filename
        full_path.write_bytes(file_content)
        
        try:
            # Use Docling to convert the document
            conversion_result = self.converter.convert(full_path)
            
            # Export to Markdown
            extracted_text = conversion_result.document.export_to_markdown()
            
            # Calculate content hash
            content_hash = self._calculate_content_hash(extracted_text)
            
            # Prepare document metadata
            document_data = {
                'filename': filename,
                'file_type': file_type,
                'file_hash': file_hash,
                'content_hash': content_hash,
                'file_size': len(file_content),
                'raw_file_path': str(full_path),
                'content': extracted_text,
                'metadata': {
                    'page_count': conversion_result.document.page_count,
                    'converter': 'docling'
                }
            }
            
            return document_data
        
        except Exception as e:
            # Clean up the file if processing fails
            full_path.unlink(missing_ok=True)
            raise ValueError(f"Document processing failed: {str(e)}")
    
    def _calculate_file_hash(self, file_content: bytes) -> str:
        """Calculate SHA-256 hash of file content"""
        return hashlib.sha256(file_content).hexdigest()
    
    def _calculate_content_hash(self, text_content: str) -> str:
        """Calculate SHA-256 hash of text content"""
        return hashlib.sha256(text_content.encode('utf-8')).hexdigest()
    
    def _get_file_type(self, filename: str) -> str:
        """Determine file type from filename extension"""
        return filename.split('.')[-1].lower()
    
    def _generate_unique_filename(self, original_filename: str, file_hash: str) -> str:
        """
        Generate a unique filename based on file hash
        
        Creates a directory structure like:
        uploads/ab/cd/abcdef1234...
        """
        # Use first two characters of hash for first-level directory
        # Next two for second-level directory
        hash_dir1 = file_hash[:2]
        hash_dir2 = file_hash[2:4]
        
        # Get file extension
        ext = Path(original_filename).suffix
        
        # Construct path
        unique_path = f"{hash_dir1}/{hash_dir2}/{file_hash}{ext}"
        
        return unique_path
    
    def chunk_document(self, document_content: str) -> List[str]:
        """
        Chunk the document text using Docling's HybridChunker
        
        Args:
            document_content (str): Full document text
        
        Returns:
            List of text chunks
        """
        return self.chunker.chunk_text(document_content)