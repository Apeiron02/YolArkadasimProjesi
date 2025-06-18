# validators.py
from abc import ABC, abstractmethod
import re

class ValidationStrategy(ABC):
    @abstractmethod
    def validate(self, data):
        pass

class EmailValidator(ValidationStrategy):
    def validate(self, email):
        pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
        if not re.match(pattern, email):
            raise ValueError("Geçersiz e-posta formatı")
        return True

class PasswordValidator(ValidationStrategy):
    def validate(self, password):
        if len(password) < 4    :
            raise ValueError("Şifre en az 5 karakter olmalıdır")
        return True

class ValidationContext:
    def __init__(self, strategy: ValidationStrategy):
        self._strategy = strategy

    def validate(self, data):
        return self._strategy.validate(data)