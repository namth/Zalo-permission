import dotenv from 'dotenv';
import { RouterAgent } from '../agents/router-agent.js';
import type { SkillDefinition, ToolGroupDefinition } from '../types.js';

dotenv.config();

async function testOpenRouter() {
  console.log('Testing OpenRouter connection with Gemini 2.0 Flash...');
  const router = new RouterAgent(process.env.OPENROUTER_API_KEY, process.env.ROUTER_MODEL_ID);

  const sampleSkills: SkillDefinition[] = [
    {
      id: 'skill-1',
      key: 'order_status_lookup',
      name: 'Tra cứu trạng thái đơn hàng',
      description: 'Dành cho khách hàng hoặc nhân viên kiểm tra tình trạng giao nhận đơn hàng qua mã vận đơn',
      systemPrompt: 'Hỏi mã đơn hàng và tra cứu API đơn hàng',
      triggerIntents: ['kiểm tra đơn hàng', 'tra cứu đơn', 'đơn hàng đến đâu rồi'],
      requiredTools: ['tool-orders'],
      isActive: true,
    },
  ];

  const sampleToolGroups: ToolGroupDefinition[] = [
    {
      id: 'tg-1',
      key: 'inventory_api',
      name: 'Kho và Tồn kho Sản phẩm',
      description: 'API tra cứu số lượng sản phẩm còn lại trong kho',
      baseUrl: 'https://api.inventory.vn',
      authType: 'BEARER',
      requiredVariables: ['API_KEY'],
      isActive: true,
    },
  ];

  console.log('\n--- Case 1: Prompt matching Skill ---');
  const decision1 = await router.classify({
    userPrompt: 'Bạn ơi tra cứu giúp mình đơn hàng số DH-88219 xem đã giao chưa?',
    accessibleSkills: sampleSkills,
    accessibleToolGroups: sampleToolGroups,
  });
  console.log('Decision 1:', JSON.stringify(decision1, null, 2));

  console.log('\n--- Case 2: Prompt falling back to Tool Groups ---');
  const decision2 = await router.classify({
    userPrompt: 'Chi nhánh Hà Nội còn bao nhiêu áo thun size L trong kho?',
    accessibleSkills: sampleSkills,
    accessibleToolGroups: sampleToolGroups,
  });
  console.log('Decision 2:', JSON.stringify(decision2, null, 2));
}

testOpenRouter().catch(console.error);
