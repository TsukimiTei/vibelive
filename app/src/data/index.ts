import type {
  Broadcaster,
  Project,
  Stream,
  ChatMessage,
  Category,
  ToolInfo,
  StreamWithDetails,
} from '@/types';

import broadcastersData from './broadcasters.json';
import projectsData from './projects.json';
import streamsData from './streams.json';
import chatMessagesData from './chat-messages.json';
import categoriesData from './categories.json';
import toolsData from './tools.json';

export const broadcasters: Broadcaster[] = broadcastersData as Broadcaster[];
export const projects: Project[] = projectsData as Project[];
export const streams: Stream[] = streamsData as Stream[];
export const chatMessages: ChatMessage[] = chatMessagesData as ChatMessage[];
export const categories: Category[] = categoriesData as Category[];
export const tools: ToolInfo[] = toolsData as ToolInfo[];

// --- 便捷查询函数 ---

export function getBroadcasterById(id: string): Broadcaster | undefined {
  return broadcasters.find((b) => b.id === id);
}

export function getProjectById(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

export function getStreamById(id: string): Stream | undefined {
  return streams.find((s) => s.id === id);
}

export function getLiveStreams(): Stream[] {
  return streams.filter((s) => s.status === 'live');
}

export function getStreamWithDetails(streamId: string): StreamWithDetails | undefined {
  const stream = getStreamById(streamId);
  if (!stream) return undefined;

  const broadcaster = getBroadcasterById(stream.broadcasterId);
  const project = getProjectById(stream.projectId);
  if (!broadcaster || !project) return undefined;

  return { ...stream, broadcaster, project };
}

export function getProjectsByCategory(category: string): Project[] {
  return projects.filter((p) => p.category === category);
}

export function getProjectsByBroadcaster(broadcasterId: string): Project[] {
  return projects.filter((p) => p.broadcasterId === broadcasterId);
}

export function getChatMessagesByStream(streamId: string): ChatMessage[] {
  return chatMessages.filter((m) => m.streamId === streamId);
}

export function getToolInfo(toolId: string): ToolInfo | undefined {
  return tools.find((t) => t.id === toolId);
}
