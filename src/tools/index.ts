/**
 * Tool definitions index
 * Exports all tools and provides filtered sets for different modes
 */

import type { ToolDefinition } from '../types';
import { readFileTool } from './read-file';
import { writeFileTool } from './write-file';
import { listDirectoryTool } from './list-directory';
import { searchFilesTool } from './search-files';
import { executeCommandTool } from './execute-command';
import { grepTool } from './grep';

// All available tools for BUILD mode
const allTools: ToolDefinition[] = [
  readFileTool,
  writeFileTool,
  listDirectoryTool,
  searchFilesTool,
  executeCommandTool,
  grepTool,
];

// Read-only tools for PLAN mode
const planModeTools: ToolDefinition[] = [
  readFileTool,
  listDirectoryTool,
  searchFilesTool,
  grepTool,
];

export function getAllTools(): ToolDefinition[] {
  return allTools;
}

export function getPlanModeTools(): ToolDefinition[] {
  return planModeTools;
}

export function getToolByName(name: string): ToolDefinition | undefined {
  return allTools.find((t) => t.name === name);
}

export {
  readFileTool,
  writeFileTool,
  listDirectoryTool,
  searchFilesTool,
  executeCommandTool,
  grepTool,
};
