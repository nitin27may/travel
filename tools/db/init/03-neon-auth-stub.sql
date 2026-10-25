-- Local-test stub of the three Managed Better Auth tables our code reads (columns copied from the Neon child
-- branch on 25 Oct 2026). Never created on Neon and never in a migration; core/test/db/stub.test.ts compares
-- the column lists with the real schema when it is pointed at the child.
create role neon_auth nologin;
create schema neon_auth authorization neon_auth;
set role neon_auth;

create table neon_auth."user" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null,
  image text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp,
  role text,
  banned boolean,
  "banReason" text,
  "banExpires" timestamptz
);

create table neon_auth.session (
  id uuid primary key default gen_random_uuid(),
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" uuid not null references neon_auth."user"(id) on delete cascade,
  "impersonatedBy" text,
  "activeOrganizationId" text
);

create table neon_auth.account (
  id uuid primary key default gen_random_uuid(),
  "accountId" text not null,
  "providerId" text not null,
  "userId" uuid not null references neon_auth."user"(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null
);

reset role;
grant usage on schema neon_auth to neondb_owner;
grant select on neon_auth."user" to neondb_owner;
grant delete on neon_auth.session to neondb_owner;
