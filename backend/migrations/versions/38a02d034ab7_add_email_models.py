"""add_email_models

Revision ID: 38a02d034ab7
Revises: 555c66b53bed
Create Date: 2026-01-19 14:27:51.343132

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '38a02d034ab7'
down_revision: Union[str, None] = '555c66b53bed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create email_accounts table
    op.create_table('email_accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('email_address', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_accounts_id'), 'email_accounts', ['id'], unique=False)
    op.create_index(op.f('ix_email_accounts_email_address'), 'email_accounts', ['email_address'], unique=True)
    
    # Create email_folders table
    op.create_table('email_folders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('is_system', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['email_accounts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_folders_account_id'), 'email_folders', ['account_id'], unique=False)
    
    # Create email_messages table
    op.create_table('email_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('subject', sa.String(length=998), nullable=True),
        sa.Column('from_address', sa.String(length=255), nullable=False),
        sa.Column('to_address', sa.String(length=1000), nullable=False),
        sa.Column('cc_address', sa.Text(), nullable=True),
        sa.Column('bcc_address', sa.Text(), nullable=True),
        sa.Column('body_text', sa.Text(), nullable=True),
        sa.Column('body_html', sa.Text(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False),
        sa.Column('is_sent', sa.Boolean(), nullable=False),
        sa.Column('is_draft', sa.Boolean(), nullable=False),
        sa.Column('is_archived', sa.Boolean(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.Column('is_starred', sa.Boolean(), nullable=False),
        sa.Column('is_important', sa.Boolean(), nullable=False),
        sa.Column('folder_id', sa.Integer(), nullable=True),
        sa.Column('message_id_header', sa.String(length=255), nullable=True),
        sa.Column('received_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['email_accounts.id'], ),
        sa.ForeignKeyConstraint(['folder_id'], ['email_folders.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_messages_account_id'), 'email_messages', ['account_id'], unique=False)
    op.create_index(op.f('ix_email_messages_folder_id'), 'email_messages', ['folder_id'], unique=False)
    op.create_index(op.f('ix_email_messages_is_archived'), 'email_messages', ['is_archived'], unique=False)
    op.create_index(op.f('ix_email_messages_is_deleted'), 'email_messages', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_email_messages_is_sent'), 'email_messages', ['is_sent'], unique=False)
    op.create_index(op.f('ix_email_messages_message_id_header'), 'email_messages', ['message_id_header'], unique=False)
    op.create_index(op.f('ix_email_messages_received_at'), 'email_messages', ['received_at'], unique=False)
    
    # Create email_attachments table
    op.create_table('email_attachments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('message_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=100), nullable=True),
        sa.Column('file_path', sa.String(length=512), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['message_id'], ['email_messages.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_attachments_message_id'), 'email_attachments', ['message_id'], unique=False)


def downgrade() -> None:
    op.drop_table('email_attachments')
    op.drop_table('email_messages')
    op.drop_table('email_folders')
    op.drop_table('email_accounts')