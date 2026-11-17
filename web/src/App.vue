<script setup>
import { onMounted, onUnmounted } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import ToastList from './components/ToastList.vue';
import { subscribeToNotifications, notificationText } from './api/notifications.js';
import { useToasts } from './composables/toasts.js';

const { showToast } = useToasts();
let unsubscribe = () => {};

// App.vue lives as long as the tab, so one stream per open browser tab.
onMounted(() => {
  unsubscribe = subscribeToNotifications((notification) => {
    const text = notificationText(notification);
    if (text) showToast(text, { link: `/events/${notification.data.eventId}` });
  });
});
onUnmounted(() => unsubscribe());
</script>

<template>
  <header class="site-header">
    <RouterLink to="/" class="brand">Campus Events</RouterLink>
    <nav>
      <RouterLink to="/">Events</RouterLink>
      <RouterLink to="/stats">Occupancy</RouterLink>
      <RouterLink to="/events/new" class="button button--small">New event</RouterLink>
    </nav>
  </header>
  <main class="page">
    <RouterView />
  </main>
  <ToastList />
</template>
