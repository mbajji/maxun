import 'dotenv/config';
import { Extract } from 'maxun-sdk';

const extractor = new Extract({
  apiKey: process.env.MAXUN_API_KEY,
  baseUrl: process.env.MAXUN_BASE_URL || 'http://localhost:8080/api/sdk',
});

// Pull the list limit out of a robot's saved workflow
function getListLimit(robot) {
  const workflow = robot.getData().recording?.workflow || [];
  for (const pair of workflow) {
    for (const action of pair.what || []) {
      if (action.action === 'scrapeList' && action.args?.[0]) {
        return action.args[0].limit ?? action.args[0].maxItems;
      }
    }
  }
  return undefined;
}

async function main() {
  // 1. Make a list robot with a limit of 20
  const robot = await extractor
    .create(`bug-demo-${Date.now()}`)
    .navigate('https://maheswaribajji.vercel.app/')
    .wait(1500)
    .captureList({ selector: '.tabs', maxItems: 20 });

  await robot.refresh();
  const oldLimit = getListLimit(robot);
  const newLimit = 100;

  console.log('Robot:', robot.id);
  console.log('OLD list limit :', oldLimit);
  console.log('I want to set it to:', newLimit);

  // 2. Try the clean way the task wants  ->  method does not exist
  console.log('\n👉 Trying robot.updateListLimit(100) ...');
  try {
    await robot.updateListLimit(newLimit);
    console.log('   🎉 updated!');
  } catch (err) {
    console.log('   ❌ CANNOT UPDATE:', err.message);
    console.log('      (the SDK has no updateListLimit() method — oh no 😱)');
  }

  // 3. Try sending just the limit piece through the existing update()
  console.log('\n👉 Trying to send only the limit via update({ limits: [...] }) ...');
  try {
    await robot.update({
      limits: [{ pairIndex: 0, actionIndex: 0, argIndex: 0, limit: newLimit }],
    });
    console.log('   (server accepted the request without error)');
  } catch (err) {
    console.log('   error:', err.message);
  }

  // 4. Re-read from server and prove nothing changed
  await robot.refresh();
  const afterLimit = getListLimit(robot);
  console.log('\nNEW list limit :', afterLimit, '  <-- still', oldLimit, '!');
  console.log(
    afterLimit === oldLimit
      ? '🔴 NO CHANGE. The limit is unchanged — the bug is confirmed.'
      : '🟢 It changed (bug is fixed).'
  );

  await robot.delete();
  console.log('\n(cleaned up demo robot)');
}

main().catch((err) => {
  console.error('Script error:', err.message);
  process.exit(1);
});
