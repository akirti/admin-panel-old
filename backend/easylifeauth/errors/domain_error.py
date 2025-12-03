"""Domain Error Classes"""


class DomainError(Exception):
    """Domain Error"""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class DomainNotFoundError(Exception):
    """Domain not Found"""
    def __init__(self, message: str, status_code: int = 404):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class DomainKeyError(Exception):
    """Domain Key not Found"""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class DomainNotAuthorizeError(Exception):
    """Domain not Authorized"""
    def __init__(self, message: str, status_code: int = 403):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class DomainNotAuthenitcatedError(Exception):
    """Domain not Authenticated"""
    def __init__(self, message: str, status_code: int = 401):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class DomainBadError(Exception):
    """Domain Bad data"""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)
