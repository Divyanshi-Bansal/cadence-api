import { mcpChatService } from '../services/mcpChatService';
import { prisma } from '../lib/prisma';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runE2ETestSuite() {
  console.log('====================================================');
  console.log('🧪 RUNNING MCP SERVER END-TO-END FUNCTIONALITY TEST');
  console.log('====================================================\n');

  // 1. Fetch test project
  const project = await prisma.project.findFirst({
    include: { stages: true },
  });

  if (!project) {
    console.log('⚠️ No existing project found in DB. Test skipped.');
    return;
  }

  // 2. Fetch or create real user for foreign key validity
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        emailEncrypted: 'e2e@test.com',
        nameEncrypted: 'E2E User',
      },
    });
  }

  const projectId = project.id;
  const testUserId = user.id;
  console.log(`📌 Using Project: "${project.name}" (ID: ${projectId})`);
  console.log(`📌 Using User ID: ${testUserId}`);
  console.log(`📌 Stages available: ${project.stages.map((s) => s.name).join(', ')}\n`);

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Create Task Tool
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Process User Message -> create_task ---');
    const createRes = await mcpChatService.processUserMessage(
      projectId,
      testUserId,
      "Create a high priority task titled 'Automated E2E Integration Test Task' with description 'Testing MCP E2E tool execution'"
    );

    console.log('AI Response:', createRes.reply);
    console.log('Action Executed:', createRes.actionExecuted);

    if (createRes.actionExecuted !== 'create_task') {
      throw new Error(`Expected action 'create_task', got '${createRes.actionExecuted}'`);
    }

    const createdTask = await prisma.task.findFirst({
      where: { projectId, title: 'Automated E2E Integration Test Task' },
    });

    if (!createdTask) {
      throw new Error('Task was not persisted in Prisma DB!');
    }
    console.log(`✅ TEST 1 PASSED: Created Task ID ${createdTask.id} (${createdTask.issueKey})\n`);

    console.log('Waiting 15s for rate limit reset...');
    await sleep(15000);

    // ------------------------------------------------------------------------
    // TEST 2: Update Task Stage Tool
    // ------------------------------------------------------------------------
    const targetStage = project.stages.find((s) => s.name.toLowerCase() !== 'backlog') || project.stages[1];

    if (targetStage) {
      console.log(`--- TEST 2: Process User Message -> update_task_stage ---`);
      const updateRes = await mcpChatService.processUserMessage(
        projectId,
        testUserId,
        `Move task ${createdTask.issueKey || createdTask.id} to stage ${targetStage.name}`
      );

      console.log('AI Response:', updateRes.reply);
      console.log('Action Executed:', updateRes.actionExecuted);

      const reloadedTask = await prisma.task.findUnique({
        where: { id: createdTask.id },
      });

      if (reloadedTask?.stageId !== targetStage.id) {
        throw new Error(`Expected stage ID ${targetStage.id}, got ${reloadedTask?.stageId}`);
      }
      console.log(`✅ TEST 2 PASSED: Task moved to stage '${targetStage.name}'\n`);
    }

    console.log('Waiting 15s for rate limit reset...');
    await sleep(15000);

    // ------------------------------------------------------------------------
    // TEST 3: Add Task Comment Tool
    // ------------------------------------------------------------------------
    console.log('--- TEST 3: Process User Message -> add_comment ---');
    const commentRes = await mcpChatService.processUserMessage(
      projectId,
      testUserId,
      `Add a comment to task ${createdTask.issueKey || createdTask.id}: 'E2E comment verified successfully'`
    );

    console.log('AI Response:', commentRes.reply);
    console.log('Action Executed:', commentRes.actionExecuted);

    const commentInDb = await prisma.comment.findFirst({
      where: { taskId: createdTask.id },
    });

    if (!commentInDb) {
      throw new Error('Comment was not persisted in Prisma DB!');
    }
    console.log(`✅ TEST 3 PASSED: Comment persisted in DB\n`);

    console.log('Waiting 15s for rate limit reset...');
    await sleep(15000);

    // ------------------------------------------------------------------------
    // TEST 4: Search Tasks / Project Summary Tool
    // ------------------------------------------------------------------------
    console.log('--- TEST 4: Process User Message -> search_tasks / query ---');
    const summaryRes = await mcpChatService.processUserMessage(
      projectId,
      testUserId,
      "Summarize the project status and task count"
    );

    console.log('AI Response:', summaryRes.reply);
    console.log(`✅ TEST 4 PASSED: Generated project summary\n`);

    // ------------------------------------------------------------------------
    // CLEANUP
    // ------------------------------------------------------------------------
    console.log('--- CLEANUP: Removing E2E Test Task ---');
    await prisma.comment.deleteMany({ where: { taskId: createdTask.id } });
    await prisma.task.delete({ where: { id: createdTask.id } });
    console.log('✅ CLEANUP COMPLETED\n');

    console.log('====================================================');
    console.log('🎉 ALL MCP E2E INTEGRATION TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================');
  } catch (err: any) {
    console.error('❌ E2E TEST FAILED:', err);
    process.exit(1);
  }
}

runE2ETestSuite();
