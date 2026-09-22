import { connectToDatabase } from './src/lib/db';
import { Report } from './src/models/Report';

async function test() {
  await connectToDatabase();
  const count = await Report.countDocuments();
  console.log("Report count in DB:", count);
  const reports = await Report.find();
  console.log("Reports:", reports);
  process.exit(0);
}
test();
