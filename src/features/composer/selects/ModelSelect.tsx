import { memo, type RefObject } from 'react'
import type { JsonObject } from '../../../../shared/types.ts'
import { fuzzyModelMatch } from '../composer-utils.ts'
import { ComposerSelect } from './ComposerSelect.tsx'

/** Selects the active LLM model from Pi's available models, issuing a set_model command on change. */
export const ModelSelect = memo(function ModelSelect(
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
        // Value is the canonical "provider/id" (hyphenated); label shows the
        // provider alongside the human-readable name. Search matches both the
        // hyphenated id and the spaced display name, and tolerates typos.
        return {
          label: `${item.provider}/${item.name ?? item.id}`,
          value: `${item.provider}/${item.id}`,
        }
      })}
      filter={(query, option) => fuzzyModelMatch(query, option.value, option.label)}
      placeholder='Choose a model'
      searchable
      searchEmptyLabel='No models match your search'
      searchPlaceholder='Search provider/model or model name'
      tone='model'
      triggerRef={triggerRef}
      value={currentModel}
    />
  )
})
