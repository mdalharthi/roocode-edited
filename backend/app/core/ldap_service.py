"""
LDAP Service for Active Directory user verification.
Uses ldap3 library for LDAPS connections.
"""

import logging
from typing import Optional
from dataclasses import dataclass

from ldap3 import Server, Connection, ALL, SUBTREE, Tls
from ldap3.core.exceptions import LDAPException, LDAPBindError, LDAPSocketOpenError

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class LDAPUserInfo:
    """Information retrieved from LDAP for a user."""
    username: str
    verified: bool
    display_name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None


class LDAPService:
    """
    LDAP service for verifying users against Active Directory.
    
    Uses LDAPS (port 636) with SSL/TLS for secure connections.
    Falls back to 'unknown' on any connection or lookup failure.
    """
    
    _instance: Optional["LDAPService"] = None
    
    def __init__(self):
        self._server: Optional[Server] = None
        self._initialized = False
    
    @classmethod
    def get_instance(cls) -> "LDAPService":
        """Get the singleton instance of the LDAP service."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def _get_server(self) -> Server:
        """Get or create the LDAP server connection."""
        if self._server is None:
            # Configure TLS for LDAPS
            if settings.LDAP_USE_SSL:
                import ssl
                tls = Tls(validate=ssl.CERT_NONE)  # May need to adjust for production
                self._server = Server(
                    settings.LDAP_HOST,
                    port=settings.LDAP_PORT,
                    use_ssl=True,
                    tls=tls,
                    get_info=ALL,
                    connect_timeout=settings.LDAP_TIMEOUT,
                )
            else:
                self._server = Server(
                    settings.LDAP_HOST,
                    port=settings.LDAP_PORT,
                    use_ssl=False,
                    get_info=ALL,
                    connect_timeout=settings.LDAP_TIMEOUT,
                )
            self._initialized = True
        return self._server
    
    def _create_connection(self) -> Optional[Connection]:
        """Create a bound LDAP connection."""
        if not settings.LDAP_BIND_DN or not settings.LDAP_BIND_PASSWORD:
            logger.warning("LDAP credentials not configured, skipping LDAP verification")
            return None
        
        try:
            server = self._get_server()
            conn = Connection(
                server,
                user=settings.LDAP_BIND_DN,
                password=settings.LDAP_BIND_PASSWORD,
                auto_bind=True,
                read_only=True,
                receive_timeout=settings.LDAP_TIMEOUT,
            )
            return conn
        except LDAPBindError as e:
            logger.error(f"LDAP bind failed: {e}")
            return None
        except LDAPSocketOpenError as e:
            logger.error(f"LDAP connection failed: {e}")
            return None
        except LDAPException as e:
            logger.error(f"LDAP error: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error connecting to LDAP: {e}")
            return None
    
    def verify_user(self, username: str) -> LDAPUserInfo:
        """
        Verify if a user exists in Active Directory.
        
        Args:
            username: The username to verify (from os.userInfo())
            
        Returns:
            LDAPUserInfo with verified=True if found, or username='unknown' if not found
        """
        if not username or username.lower() == "unknown":
            return LDAPUserInfo(username="unknown", verified=False)
        
        conn = self._create_connection()
        if conn is None:
            # No connection available, return as unverified but keep username
            logger.warning(f"No LDAP connection, cannot verify user: {username}")
            return LDAPUserInfo(username=username, verified=False)
        
        try:
            # Build the search filter
            search_filter = settings.LDAP_SEARCH_FILTER % username
            
            logger.info(f"LDAP search - base: '{settings.LDAP_SEARCH_BASE}', filter: '{search_filter}'")
            
            # Search for the user
            success = conn.search(
                search_base=settings.LDAP_SEARCH_BASE,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=["uid", "sAMAccountName", "cn", "displayName", "mail", "department"],
            )
            
            logger.info(f"LDAP search result: success={success}, entries={len(conn.entries)}")
            
            # If primary filter didn't find the user, try fallback with sAMAccountName
            if not (success and len(conn.entries) > 0):
                fallback_filter = f"(&(objectClass=user)(sAMAccountName={username}))"
                logger.info(f"Primary search found nothing, trying fallback filter: '{fallback_filter}'")
                success = conn.search(
                    search_base=settings.LDAP_SEARCH_BASE,
                    search_filter=fallback_filter,
                    search_scope=SUBTREE,
                    attributes=["uid", "sAMAccountName", "cn", "displayName", "mail", "department"],
                )
                logger.info(f"Fallback search result: success={success}, entries={len(conn.entries)}")
            
            if success and len(conn.entries) > 0:
                entry = conn.entries[0]
                logger.info(f"Found LDAP entry: {entry.entry_dn}")
                
                # Extract user information
                display_name = str(entry.displayName) if hasattr(entry, 'displayName') and entry.displayName else None
                email = str(entry.mail) if hasattr(entry, 'mail') and entry.mail else None
                department = str(entry.department) if hasattr(entry, 'department') and entry.department else None
                
                logger.info(f"User '{username}' verified in Active Directory")
                return LDAPUserInfo(
                    username=username,
                    verified=True,
                    display_name=display_name,
                    email=email,
                    department=department,
                )
            else:
                logger.warning(f"User '{username}' not found in Active Directory (tried both uid and sAMAccountName)")
                return LDAPUserInfo(username="unknown", verified=False)
                
        except LDAPException as e:
            logger.error(f"LDAP search failed for user '{username}': {e}")
            return LDAPUserInfo(username="unknown", verified=False)
        except Exception as e:
            logger.error(f"Unexpected error during LDAP search: {e}")
            return LDAPUserInfo(username="unknown", verified=False)
        finally:
            try:
                conn.unbind()
            except Exception:
                pass
    
    def authenticate_user(self, username: str, password: str) -> Optional[LDAPUserInfo]:
        """
        Authenticate a user against Active Directory using their credentials.
        
        This method attempts to bind to LDAP using the user's own credentials,
        which verifies that the username and password are correct.
        
        Args:
            username: The username to authenticate
            password: The user's password
            
        Returns:
            LDAPUserInfo with verified=True if authentication succeeds, None if it fails
        """
        if not username or not password:
            logger.warning("Username or password not provided for LDAP authentication")
            return None
        
        try:
            server = self._get_server()
            
            # For Active Directory, we can bind using different formats:
            # 1. UPN (User Principal Name): username@domain.com
            # 2. DOMAIN\username (NetBIOS format)
            # 3. Full DN: CN=username,OU=Users,DC=domain,DC=com
            
            # Use the configured user domain for UPN authentication
            domain = settings.LDAP_USER_DOMAIN
            
            # Use UPN format for user binding (username@domain)
            if domain and "@" not in username:
                user_bind_name = f"{username}@{domain}"
            else:
                user_bind_name = username
            
            # Attempt to bind with user credentials
            user_conn = Connection(
                server,
                user=user_bind_name,
                password=password,
                auto_bind=True,
                read_only=True,
                receive_timeout=settings.LDAP_TIMEOUT,
            )
            
            # If we get here, authentication succeeded
            # Now search for user details using the user's own connection
            search_filter = settings.LDAP_SEARCH_FILTER % username
            success = user_conn.search(
                search_base=settings.LDAP_SEARCH_BASE,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=["uid", "cn", "displayName", "mail", "department"],
            )
            
            user_info = LDAPUserInfo(username=username, verified=True)
            
            if success and len(user_conn.entries) > 0:
                entry = user_conn.entries[0]
                user_info.display_name = str(entry.displayName) if hasattr(entry, 'displayName') and entry.displayName else None
                user_info.email = str(entry.mail) if hasattr(entry, 'mail') and entry.mail else None
                user_info.department = str(entry.department) if hasattr(entry, 'department') and entry.department else None
            
            user_conn.unbind()
            logger.info(f"User '{username}' authenticated successfully via LDAP")
            return user_info
            
        except LDAPBindError as e:
            logger.warning(f"LDAP authentication failed for user '{username}': invalid credentials")
            return None
        except LDAPSocketOpenError as e:
            logger.error(f"LDAP connection failed during authentication: {e}")
            return None
        except LDAPException as e:
            logger.error(f"LDAP error during authentication for user '{username}': {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during LDAP authentication: {e}")
            return None

    
    def is_configured(self) -> bool:
        """Check if LDAP is properly configured."""
        return bool(settings.LDAP_BIND_DN and settings.LDAP_BIND_PASSWORD)
    
    def test_connection(self) -> bool:
        """Test the LDAP connection."""
        conn = self._create_connection()
        if conn is None:
            return False
        try:
            conn.unbind()
            return True
        except Exception:
            return False


# Convenience function for direct use
def verify_ldap_user(username: str) -> LDAPUserInfo:
    """
    Verify a user against Active Directory.
    
    This is the main entry point for LDAP verification.
    
    Args:
        username: The username to verify
        
    Returns:
        LDAPUserInfo with verification result
    """
    service = LDAPService.get_instance()
    return service.verify_user(username)
