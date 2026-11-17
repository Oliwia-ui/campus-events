import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ToastList from '../src/components/ToastList.vue';
import { useToasts, TOAST_DURATION_MS } from '../src/composables/toasts.js';

describe('ToastList', () => {
  const { toasts, showToast } = useToasts();
  // RouterLink needs a router; a stub is enough to check the text.
  const mountList = () => mount(ToastList, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } });

  beforeEach(() => {
    vi.useFakeTimers();
    toasts.value = [];
  });
  afterEach(() => vi.useRealTimers());

  it('shows one toast per call', async () => {
    const wrapper = mountList();

    showToast('New event: Pizza night');
    showToast('Someone just registered for Pizza night');
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.toast')).toHaveLength(2);
    expect(wrapper.text()).toContain('New event: Pizza night');
  });

  it('removes a toast after a few seconds', async () => {
    const wrapper = mountList();
    showToast('New event: Pizza night');

    vi.advanceTimersByTime(TOAST_DURATION_MS);
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.toast')).toHaveLength(0);
  });

  it('closes a toast with its button', async () => {
    const wrapper = mountList();
    showToast('New event: Pizza night');
    await wrapper.vm.$nextTick();

    await wrapper.find('.toast__close').trigger('click');

    expect(wrapper.findAll('.toast')).toHaveLength(0);
  });
});
