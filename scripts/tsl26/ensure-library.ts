import { MongoClient } from 'mongodb';

const DEFAULT_MONGODB_URI = 'mongodb://localhost:27017/trainerStudioDB';
const DEFAULT_DATABASE_NAME = 'trainerStudioDB';
const DEFAULT_LIBRARY_NAME = 'TrainerStudio official';

function getArgValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const exactIndex = process.argv.indexOf(`--${name}`);

  if (exactIndex !== -1) {
    return process.argv[exactIndex + 1];
  }

  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

async function main(): Promise<void> {
  const mongodbUri = getArgValue('mongodb-uri') ?? process.env.MONGODB_URI ?? DEFAULT_MONGODB_URI;
  const databaseName = getArgValue('database') ?? process.env.MONGODB_DB_NAME ?? DEFAULT_DATABASE_NAME;
  const name = getArgValue('name') ?? process.env.TSL26_LIBRARY_NAME ?? DEFAULT_LIBRARY_NAME;

  if (!name.trim()) {
    throw new Error('Library name cannot be empty');
  }

  const client = new MongoClient(mongodbUri);

  try {
    await client.connect();
    const db = client.db(databaseName);
    const now = new Date();
    const library = await db.collection('libraries').findOneAndUpdate(
      { name },
      {
        $setOnInsert: { name, createdAt: now },
        $set: { updatedAt: now },
      },
      { upsert: true, returnDocument: 'after' },
    );

    if (!library) {
      throw new Error(`Unable to create or find library: ${name}`);
    }

    console.log(`MongoDB: ${mongodbUri}`);
    console.log(`Database: ${databaseName}`);
    console.log(`Library: ${library.name ?? name} (${library._id.toHexString()})`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
