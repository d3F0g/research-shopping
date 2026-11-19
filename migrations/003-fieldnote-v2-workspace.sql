create table fieldnote_v2_workspace (
  user_id text primary key references "user" (id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0 and revision <= 9007199254740991),
  epoch bigint not null default 0 check (epoch >= 0 and epoch <= 9007199254740991),
  data jsonb not null,
  check (octet_length(data::text) <= 300000)
);
