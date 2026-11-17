import { ref } from 'vue';

// One shared list for the whole app: any page can show a toast, App.vue renders them.
const toasts = ref([]);
let nextId = 1;

export const TOAST_DURATION_MS = 5000;

export function useToasts() {
  function dismiss(id) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  function showToast(text, { link } = {}) {
    const id = nextId++;
    toasts.value = [...toasts.value, { id, text, link }];
    setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    return id;
  }

  return { toasts, showToast, dismiss };
}
