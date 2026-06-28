<script setup lang="ts">
import type { VariantProps } from 'class-variance-authority'
import { cn } from '@/utils'
import { cva } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-vue-next'

defineProps<{
  variant?: ActionButtonVariant
  stretch?: boolean
  disabled?: boolean
  loading?: boolean
  title?: string
}>()

const actionButtonVariants = cva(
  [
    'group inline-flex min-h-10 items-center gap-2.5 rounded-lg border px-3.5 py-2',
    'text-left text-sm font-medium leading-none transition-all',
    'outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:opacity-45',
    'active:scale-[0.98]',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'border-primary/25 bg-primary text-primary-foreground shadow-xs hover:border-primary/40 hover:bg-primary/90',
        secondary:
          'border-border bg-background text-foreground shadow-xs hover:border-border hover:bg-accent hover:text-accent-foreground',
        accent:
          'border-primary/20 bg-primary/8 text-foreground shadow-xs hover:border-primary/30 hover:bg-primary/12',
      },
      stretch: {
        true: 'flex-1 basis-[calc(50%-0.25rem)] sm:basis-auto sm:flex-none',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      stretch: false,
    },
  },
)

type ActionButtonVariant = NonNullable<
  VariantProps<typeof actionButtonVariants>['variant']
>
</script>

<template>
  <button
    type="button"
    :disabled="disabled || loading"
    :title="title"
    :class="cn(actionButtonVariants({ variant, stretch }))"
  >
    <span
      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
      :class="
        variant === 'primary'
          ? 'bg-primary-foreground/15 text-primary-foreground'
          : variant === 'accent'
            ? 'bg-primary/12 text-primary'
            : 'bg-muted text-foreground group-hover:bg-muted/80'
      "
    >
      <LoaderCircle
        v-if="loading"
        class="h-4 w-4 animate-spin"
      />
      <slot
        v-else
        name="icon"
      />
    </span>
    <span class="min-w-0 truncate">
      <slot />
    </span>
  </button>
</template>
