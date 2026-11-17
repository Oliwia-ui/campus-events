<script setup>
import { RouterLink } from 'vue-router';
import { useToasts } from '../composables/toasts.js';

const { toasts, dismiss } = useToasts();
</script>

<template>
  <!-- aria-live: screen readers read a new toast without moving the focus. -->
  <div class="toast-list" role="status" aria-live="polite">
    <div v-for="toast in toasts" :key="toast.id" class="toast">
      <RouterLink v-if="toast.link" :to="toast.link" class="toast__text" @click="dismiss(toast.id)">{{ toast.text }}</RouterLink>
      <span v-else class="toast__text">{{ toast.text }}</span>
      <button type="button" class="toast__close" aria-label="Close notification" @click="dismiss(toast.id)">×</button>
    </div>
  </div>
</template>
