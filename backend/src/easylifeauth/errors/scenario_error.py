"""Scenario Error Classes"""


class ScenarioError(Exception):
    """Scenario Error"""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ScenarioNotFoundError(Exception):
    """Scenario not Found"""
    def __init__(self, message: str, status_code: int = 404):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ScenarioKeyError(Exception):
    """Scenario Key not Found"""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ScenarioNotAuthorizeError(Exception):
    """Scenario not Authorized"""
    def __init__(self, message: str, status_code: int = 403):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ScenarioNotAuthenitcatedError(Exception):
    """Scenario not Authenticated"""
    def __init__(self, message: str, status_code: int = 401):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ScenarioBadError(Exception):
    """Scenario Bad data"""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)
