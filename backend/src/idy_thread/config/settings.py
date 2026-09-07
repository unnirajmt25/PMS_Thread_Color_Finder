"""Centralized application configuration.

Every other module reads config through `get_settings()` — connection
strings are never hard-coded or assembled ad hoc elsewhere (see section 31
of the project spec: "Do not scatter connection strings throughout the
application").
"""

from __future__ import annotations

from functools import lru_cache
from urllib.parse import quote_plus

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = Field(default="development", alias="APP_ENV")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    sql_server_host: str = Field(default=r".\SQLEXPRESS", alias="SQL_SERVER_HOST")
    sql_server_port: str = Field(default="", alias="SQL_SERVER_PORT")
    sql_server_database: str = Field(default="IdyThreadIntelligence", alias="SQL_SERVER_DATABASE")
    sql_server_user: str = Field(default="", alias="SQL_SERVER_USER")
    sql_server_password: str = Field(default="", alias="SQL_SERVER_PASSWORD")
    sql_server_trusted_connection: bool = Field(default=True, alias="SQL_SERVER_TRUSTED_CONNECTION")
    sql_server_driver: str = Field(default="ODBC Driver 18 for SQL Server", alias="SQL_SERVER_DRIVER")
    sql_server_trust_server_certificate: bool = Field(
        default=True, alias="SQL_SERVER_TRUST_SERVER_CERTIFICATE"
    )

    database_url_override: str = Field(default="", alias="DATABASE_URL")

    def _odbc_params(self, *, database: str) -> dict:
        host = self.sql_server_host
        if self.sql_server_port:
            host = f"{host},{self.sql_server_port}"

        params = {
            "DRIVER": self.sql_server_driver,
            "SERVER": host,
            "DATABASE": database,
        }
        if self.sql_server_trusted_connection:
            params["Trusted_Connection"] = "yes"
        else:
            params["UID"] = self.sql_server_user
            params["PWD"] = self.sql_server_password
        if self.sql_server_trust_server_certificate:
            params["TrustServerCertificate"] = "yes"
        return params

    @staticmethod
    def _to_sqlalchemy_url(odbc_params: dict) -> str:
        odbc_str = ";".join(f"{k}={v}" for k, v in odbc_params.items())
        return f"mssql+pyodbc:///?odbc_connect={quote_plus(odbc_str)}"

    @computed_field  # type: ignore[misc]
    @property
    def database_url(self) -> str:
        """SQLAlchemy connection URL, built from the pieces above unless
        DATABASE_URL is set explicitly in the environment."""
        if self.database_url_override:
            return self.database_url_override
        return self._to_sqlalchemy_url(self._odbc_params(database=self.sql_server_database))

    @computed_field  # type: ignore[misc]
    @property
    def master_database_url(self) -> str:
        """Same connection, pointed at `master` — used only for the
        one-time "does our database exist yet?" check, since you can't
        connect to a database that doesn't exist yet to create it. Built
        from the same param dict as database_url (not a string-replace on
        the percent-encoded URL, which would never match)."""
        if self.database_url_override:
            return self.database_url_override
        return self._to_sqlalchemy_url(self._odbc_params(database="master"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
