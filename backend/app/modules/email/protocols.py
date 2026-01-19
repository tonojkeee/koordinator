"""
Service Protocols for Email Module

Protocol-based interfaces to enable dependency injection
and decouple modules from direct service dependencies.
"""

from typing import Protocol, runtime_checkable


@runtime_checkable
class EmailAccountServiceProtocol(Protocol):
    """
    Protocol for email account management operations.

    Allows auth module to depend on email service abstraction
    rather than concrete implementation, enabling testability and flexibility.
    """

    async def create_account(self, user_id: int, email_address: str) -> int:
        """
        Create email account for user.

        Args:
            user_id: User ID to associate account with
            email_address: Email address for the account

        Returns:
            Created email account ID
        """
        ...

    async def delete_account(self, user_id: int) -> None:
        """
        Delete email account for user.

        Args:
            user_id: User ID whose account to delete

        Returns:
            None
        """
        ...

    async def account_exists(self, email_address: str) -> bool:
        """
        Check if email account already exists.

        Args:
            email_address: Email address to check

        Returns:
            True if account exists, False otherwise
        """
        ...
