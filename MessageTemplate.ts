import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface MessageTemplate {
  id: string;
  displayName: string;
  content: string;
}

export class MessageTemplateManager {
  private filePath: string;

  constructor(filePath: string = 'templates.json') {
    this.filePath = path.join(process.cwd(), filePath);
  }

  private async readTemplates(): Promise<MessageTemplate[]> {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(data) as MessageTemplate[];
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw new Error(`Failed to read templates: ${error.message}`);
    }
  }

  private async writeTemplates(templates: MessageTemplate[]): Promise<void> {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(templates, null, 2));
    } catch (error) {
      throw new Error(`Failed to write templates: ${error.message}`);
    }
  }

  async getAllTemplates(): Promise<MessageTemplate[]> {
    return await this.readTemplates();
  }

  async getTemplateById(id: string): Promise<MessageTemplate | null> {
    const templates = await this.readTemplates();
    return templates.find(template => template.id === id) || null;
  }

  async createTemplate(displayName: string, content: string): Promise<MessageTemplate> {
    const templates = await this.readTemplates();
    const newTemplate: MessageTemplate = {
      id: uuidv4(),
      displayName,
      content
    };
    templates.push(newTemplate);
    await this.writeTemplates(templates);
    return newTemplate;
  }

  async updateTemplate(id: string, displayName: string, content: string): Promise<MessageTemplate | null> {
    const templates = await this.readTemplates();
    const index = templates.findIndex(template => template.id === id);
    if (index === -1) return null;
    templates[index] = { id, displayName, content };
    await this.writeTemplates(templates);
    return templates[index];
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const templates = await this.readTemplates();
    const index = templates.findIndex(template => template.id === id);
    if (index === -1) return false;
    templates.splice(index, 1);
    await this.writeTemplates(templates);
    return true;
  }
}