import type { RefObject } from 'react'
import type { JsonObject } from '../../../../shared/types.ts'
import { ComposerSelect } from './ComposerSelect.tsx'

/** Selects the active LLM model from Pi's available models, issuing a set_model command on change. */
export function ModelSelect(
  { models, currentModel, onCommand, onError, open, onOpenChange, triggerRef }: {
    models: JsonObject[]
    currentModel: string
    onCommand: (command: JsonObject) => Promise<JsonObject>
    onError: (cause: unknown) => void
    open: boolean
    onOpenChange: (open: boolean) => void
    triggerRef: RefObject<HTMLButtonElement | null>
  },
) {
  return (
    <ComposerSelect
      ariaLabel='Model'
      onOpenChange={onOpenChange}
      open={open}
      onValueChange={(value) => {
        const selected = models.find((item) => `${item.provider}/${item.id}` === value)
        if (selected)
          void onCommand({
            type: 'set_model',
            provider: selected.provider,
            modelId: selected.id,
          })
            .catch(onError)
      }}
      options={models.map((item) => {
        // Display the provider alongside the model name and search against the
        // combined "provider/model" form, so "opencode-go/deepseek-v4-flash"
        // and "deepseek-v4-flash" both match.
        const label = `${item.provider}/${item.name ?? item.id}`
        return { label, value: `${item.provider}/${item.id}` }
      })}
      placeholder='Choose a model'
      searchable
      searchEmptyLabel='No models match your search'
      searchPlaceholder='Search provider/model or model name'
      tone='model'
      triggerRef={triggerRef}
      value={currentModel}
    />
  )
}
