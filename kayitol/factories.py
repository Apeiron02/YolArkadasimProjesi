# factories.py
from django.contrib.auth.models import User
from abc import ABC, abstractmethod

class UserCreatorInterface(ABC):
    @abstractmethod
    def create_user(self, **kwargs):
        pass

class StandardUserCreator(UserCreatorInterface):
    def create_user(self, **kwargs):
        return User.objects.create_user(
            username=kwargs.get('username'),
            email=kwargs.get('email'),
            password=kwargs.get('password')
        )

class UserFactory:
    @staticmethod
    def get_creator(user_type="standard"):
        creators = {
            "standard": StandardUserCreator()
        }
        return creators.get(user_type)