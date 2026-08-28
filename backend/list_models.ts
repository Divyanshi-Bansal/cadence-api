import dotenv from 'dotenv';
dotenv.config();
const apiKey = process.env.GEMINI_API_KEY || '';
async function run() {
  let url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`;
  let hasNext = true;
  while(hasNext) {
    const data = await fetch(url).then(res => res.json());
    const models = data.models || [];
    for (const m of models) {
      if (m.name.includes("flash") || m.name.includes("gemini")) {
        console.log(m.name);
      }
    }
    if (data.nextPageToken) {
      url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100&pageToken=${data.nextPageToken}`;
    } else {
      hasNext = false;
    }
  }
}
run();
