from app.models.question import QuestionType

def convert_enum_to_string(obj):
    """
    Recursively convert any QuestionType enums to strings in an object or collection
    """
    if isinstance(obj, list):
        for i, item in enumerate(obj):
            obj[i] = convert_enum_to_string(item)
        return obj
    
    elif isinstance(obj, dict):
        for key, value in obj.items():
            obj[key] = convert_enum_to_string(value)
        return obj
    
    elif hasattr(obj, '__dict__'):
        # Handle SQLAlchemy model objects
        for key, value in obj.__dict__.items():
            if key.startswith('_'):
                continue
            
            if isinstance(value, QuestionType):
                setattr(obj, key, value.value)
            elif isinstance(value, (list, dict)) or hasattr(value, '__dict__'):
                setattr(obj, key, convert_enum_to_string(value))
        
        return obj
    
    elif isinstance(obj, QuestionType):
        return obj.value
    
    return obj