
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock, listeners } from '@tests/mocks/window'
import { store, resetStoreListeners } from '@services/store'
import { kDefaultWorkspaceId, kHistoryVersion } from '@/consts'
import Chat from '@models/chat'
import Message from '@models/message'
import defaultSettings from '@root/defaults/settings.json'
import { ModelDefaults } from '@/types/config'

const chats = [
  new Chat(),
  Chat.fromJson({
    uuid: '123',
    engine: 'engine',
    model: 'model',
    disableStreaming: false,
    tools: null,
    modelOpts: {
      temperature: 1.0
    },
    messages: [
      new Message('system', 'Hi'),
      new Message('user', 'Hello')
    ]
  })
]

// to make testing easier
// was trying to use expect.any(String) but it was not working
chats[1].messages[0].uuid = '1'
chats[1].messages[0].createdAt = 0
chats[1].messages[1].uuid = '2'
chats[1].messages[1].createdAt = 0
chats[1].messages[1].engine = 'engine'
chats[1].messages[1].model = 'model'

beforeAll(() => {
  useWindowMock()
  window.api.history.load = vi.fn(() => ({ version: kHistoryVersion, folders: [], chats: chats, quickPrompts: [] }))
  window.api.history.loadMetadata = vi.fn(() => ({ version: kHistoryVersion, folders: [], chats: chats.map(c => ({ ...JSON.parse(JSON.stringify(c)), messages: [] })), quickPrompts: [] }))
  window.api.history.loadChatMessages = vi.fn((_, chatId) => {
    const chat = chats.find(c => c.uuid === chatId)
    return chat ? JSON.parse(JSON.stringify(chat.messages)) : []
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  listeners.length = 0
  resetStoreListeners()
})

test('Check atributtes', async () => {
  expect(store.config).toEqual({})
  expect(store.commands).toEqual([])
  expect(store.experts).toEqual([])
  expect(store.history).toBeNull()
  expect(store.transcribeState.transcription).toBe('')
})

test('Load', async () => {
  store.load()
  store.config.llm.favorites = []
  expect(window.api.config?.load).toHaveBeenCalled()
  expect(window.api.experts?.load).toHaveBeenCalled()
  expect(window.api.commands?.load).toHaveBeenCalled()
  expect(window.api.history?.loadMetadata).toHaveBeenCalled()
  expect(store.config).toStrictEqual(defaultSettings)
  expect(store.history.folders).toHaveLength(0)
  expect(store.history.chats).toHaveLength(2)
  expect(store.commands).toHaveLength(5)
  expect(store.experts).toHaveLength(4)
})

test('Save settings', async () => {
  store.load()
  store.saveSettings()
  expect(window.api.config?.save).toHaveBeenCalled()
})

test('Reload settings without changing reference', async () => {
  store.load()
  expect(window.api.config?.load).toHaveBeenCalledTimes(1)
  const backup = store.config
  expect(store.config.llm.engine).toBe('openai')
  expect(store.config.plugins).toBeDefined()
  defaultSettings.llm.engine = 'xai'
  delete defaultSettings.plugins
  listeners.map(l => l('settings'))
  expect(window.api.config?.load).toHaveBeenCalledTimes(2)
  expect(store.config).toBe(backup)
  expect(store.config.llm.engine).toBe('xai')
  expect(store.config.plugins).toBeUndefined()
})

test('Load history', async () => {
  store.load()
  expect(store.history.chats).toHaveLength(2)
  expect(store.history.chats[0].messages).toHaveLength(0)
  expect(store.history.chats[0].messagesLoaded).toBe(false)
  expect(store.history.chats[1].messages).toHaveLength(0)
  expect(store.history.chats[1].messagesLoaded).toBe(false)
})

test('Save history', async () => {
  store.load()
  // explicitly load chat[1] so it has full messages; chat[0] stays unloaded
  store.loadChatMessages(store.history.chats[1])
  store.saveHistory()
  expect(window.api.history?.save).toHaveBeenCalled()
  const savedArgs = (window.api.history?.save as ReturnType<typeof vi.fn>).mock.lastCall
  const [wsId, savedHistory] = savedArgs
  expect(wsId).toBe(kDefaultWorkspaceId)
  expect(savedHistory.version).toBe(1)
  // unloaded chat[0] is preserved for main-process cache merge
  expect(savedHistory.chats).toEqual(expect.arrayContaining([
    expect.objectContaining({ uuid: chats[0].uuid, messagesLoaded: false, messages: [] })
  ]))
  // loaded chat[1] is saved with full messages
  expect(savedHistory.chats).toEqual(expect.arrayContaining([
    expect.objectContaining({
      uuid: '123',
      engine: 'engine',
      model: 'model',
      messagesLoaded: true,
      messages: expect.arrayContaining([
        expect.objectContaining({ uuid: '1', content: 'Hi' }),
        expect.objectContaining({ uuid: '2', content: 'Hello' }),
      ])
    })
  ]))
})

test('Load chat messages on demand', async () => {
  store.load()
  const chat = store.history.chats[1]
  expect(chat.messagesLoaded).toBe(false)
  expect(chat.messages).toHaveLength(0)
  store.loadChatMessages(chat)
  expect(chat.messagesLoaded).toBe(true)
  expect(chat.messages).toHaveLength(2)
  expect(chat.messages[0].content).toBe('Hi')
  expect(chat.messages[1].content).toBe('Hello')
})

test('Merge history', async () => {
  store.load()
  expect(store.history.chats).toHaveLength(2)
  expect(store.history.chats[1].messages).toHaveLength(0)
  chats.push(new Chat())
  chats[1].messages.push(new Message('user', ''))
  listeners.map(l => l('history'))
  expect(store.history.chats).toHaveLength(3)
  // messages still not loaded for existing chat (lazy)
  expect(store.history.chats[1].messages).toHaveLength(0)
  chats.splice(2, 1)
  listeners.map(l => l('history'))
  expect(store.history.chats).toHaveLength(2)
  expect(store.history.chats[1].messages).toHaveLength(0)
})

test('initChatWithDefaults applies defaults when they exist', () => {
  store.load()
  store.config.llm.defaults = [{
    engine: 'openai',
    model: 'gpt-4',
    disableStreaming: true,
    instructions: 'Default prompt',
    locale: 'fr',
    tools: ['tool1'],
    modelOpts: { temperature: 0.5 },
  }]
  const chat = new Chat()
  chat.setEngineModel('openai', 'gpt-4')
  store.initChatWithDefaults(chat)
  expect(chat.disableStreaming).toBe(true)
  expect(chat.instructions).toBe('Default prompt')
  expect(chat.locale).toBe('fr')
  expect(chat.tools).toEqual(['tool1'])
  expect(chat.modelOpts).toEqual({ temperature: 0.5 })
})

test('initChatWithDefaults resets when no defaults exist', () => {
  store.load()
  store.config.llm.defaults = []
  const chat = new Chat()
  chat.setEngineModel('openai', 'gpt-4')
  chat.disableStreaming = true
  store.initChatWithDefaults(chat)
  expect(chat.disableStreaming).toBe(false)
  expect(chat.tools).toBeNull()
  expect(chat.modelOpts).toBeUndefined()
})

test('initChatWithDefaults preserves instructions when defaults have none', () => {
  store.load()
  store.config.llm.defaults = [{
    engine: 'openai',
    model: 'gpt-4',
    disableStreaming: true,
  } as ModelDefaults]
  const chat = new Chat()
  chat.setEngineModel('openai', 'gpt-4')
  chat.instructions = 'My custom prompt'
  chat.locale = 'de'
  store.initChatWithDefaults(chat)
  expect(chat.disableStreaming).toBe(true)
  expect(chat.instructions).toBe('My custom prompt')
  expect(chat.locale).toBe('de')
})

test('initChatWithDefaults preserves instructions when no defaults exist', () => {
  store.load()
  store.config.llm.defaults = []
  const chat = new Chat()
  chat.setEngineModel('openai', 'gpt-4')
  chat.instructions = 'My custom prompt'
  chat.locale = 'de'
  store.initChatWithDefaults(chat)
  expect(chat.instructions).toBe('My custom prompt')
  expect(chat.locale).toBe('de')
})

test('initChatWithDefaults overrides instructions when defaults provide them', () => {
  store.load()
  store.config.llm.defaults = [{
    engine: 'openai',
    model: 'gpt-4',
    disableStreaming: false,
    instructions: 'Default instructions',
    locale: 'es',
  } as ModelDefaults]
  const chat = new Chat()
  chat.setEngineModel('openai', 'gpt-4')
  chat.instructions = 'My custom prompt'
  chat.locale = 'de'
  store.initChatWithDefaults(chat)
  expect(chat.instructions).toBe('Default instructions')
  expect(chat.locale).toBe('es')
})

test('Add quick prompt', async () => {
  store.load()
  expect(store.history.quickPrompts).toHaveLength(0)
  store.addQuickPrompt('my prompt')
  expect(store.history.quickPrompts).toHaveLength(1)
  expect(store.history.quickPrompts[0]).toBe('my prompt')
  store.addQuickPrompt('my other prompt')
  expect(store.history.quickPrompts).toHaveLength(2)
  expect(store.history.quickPrompts[1]).toBe('my other prompt')
  store.addQuickPrompt('my prompt')
  expect(store.history.quickPrompts).toHaveLength(2)
  expect(store.history.quickPrompts[1]).toBe('my prompt')
})
