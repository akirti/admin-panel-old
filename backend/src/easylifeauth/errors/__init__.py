"""Error classes for EasyLife Auth"""
from .auth_error import AuthError
from .domain_error import (
    DomainError, 
    DomainNotFoundError, 
    DomainKeyError, 
    DomainBadError,
    DomainNotAuthorizeError,
    DomainNotAuthenitcatedError
)
from .scenario_error import (
    ScenarioError,
    ScenarioNotFoundError,
    ScenarioKeyError,
    ScenarioBadError,
    ScenarioNotAuthorizeError,
    ScenarioNotAuthenitcatedError
)
from .playboard_error import (
    PlayboardError,
    PlayboardNotFoundError,
    PlayboardKeyError,
    PlayboardBadError,
    PlayboardNotAuthorizeError,
    PlayboardNotAuthenitcatedError
)
from .email_error import EmailError

__all__ = [
    "AuthError",
    "DomainError",
    "DomainNotFoundError",
    "DomainKeyError",
    "DomainBadError",
    "DomainNotAuthorizeError",
    "DomainNotAuthenitcatedError",
    "ScenarioError",
    "ScenarioNotFoundError",
    "ScenarioKeyError",
    "ScenarioBadError",
    "ScenarioNotAuthorizeError",
    "ScenarioNotAuthenitcatedError",
    "PlayboardError",
    "PlayboardNotFoundError",
    "PlayboardKeyError",
    "PlayboardBadError",
    "PlayboardNotAuthorizeError",
    "PlayboardNotAuthenitcatedError",
    "EmailError"
]
