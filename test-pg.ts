import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.$queryRawUnsafe('SELECT relname as "tableName", cast(pg_total_relation_size(cast(relid as regclass)) as text) as "sizeBytes" FROM pg_catalog.pg_statio_user_tables').then(console.log).finally(() => prisma.$disconnect());
