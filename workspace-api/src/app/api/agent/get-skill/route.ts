import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { neo4jClient } from '@/lib/neo4j';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface GetSkillRequest {
    skill_id: string;
}

export async function POST(req: NextRequest) {
    try {
        const body: GetSkillRequest = await req.json();
        const { skill_id } = body;

        if (!skill_id) {
            return NextResponse.json(
                { success: false, error: 'Missing required field: skill_id' },
                { status: 400 }
            );
        }

        // 2. Fetch Skill from Postgres (No authorization check requested)
        const skillRes = await db.query(
            `SELECT id, name, description, detail, is_shared, status, created_at, updated_at
             FROM skills
             WHERE id = $1 AND status = 'active'`,
            [skill_id]
        );

        if (skillRes.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Skill not found or inactive' }, { status: 404 });
        }

        const skill = skillRes.rows[0];

        // 3. Get Tool relationships from Neo4j
        const relations = await neo4jClient.getSkillRelations(skill_id);
        const toolIds = relations.tools.map(t => t.id);

        // 4. Fetch full Tool details from Postgres
        let toolsMarkdown = "";
        if (toolIds.length > 0) {
            const toolsRes = await db.query(
                `SELECT id, key, name, description, input_schema, output_schema, status
                 FROM tools
                 WHERE id = ANY($1::uuid[]) AND status = 'active'
                 ORDER BY name ASC`,
                [toolIds]
            );
            
            const toolsArray = toolsRes.rows.map(row => ({
                ...row,
                input_schema: typeof row.input_schema === 'string' ? JSON.parse(row.input_schema) : row.input_schema,
                output_schema: typeof row.output_schema === 'string' ? JSON.parse(row.output_schema) : row.output_schema,
            }));

            toolsMarkdown = toolsArray.map((t, idx) => {
                let md = `### ${idx + 1}. Tool: ${t.name} (Key: \`${t.key}\`)\n` +
                `- **UUID**: ${t.id}\n` +
                `- **Description**: ${t.description || 'No description'}\n` +
                `- **Parameters Schema**:\n\`\`\`json\n${JSON.stringify(t.input_schema, null, 2)}\n\`\`\``;
                
                if (t.output_schema) {
                    md += `\n- **Output Schema**:\n\`\`\`json\n${JSON.stringify(t.output_schema, null, 2)}\n\`\`\``;
                }
                return md;
            }).join('\n\n');
        }

        return NextResponse.json({
            success: true,
            data: {
                ...skill,
                category: relations.category,
                tools: toolsMarkdown
            }
        });

    } catch (error) {
        logger.error(`POST /api/agent/get-skill error: ${error}`);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
