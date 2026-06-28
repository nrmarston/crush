<script lang="ts">
	import { useTheme } from 'svelte-themes';

	const theme = useTheme();
	const themeColor = $derived(theme.resolvedTheme === 'dark' ? '#101114' : '#f7f7f7');
</script>

<svelte:head>
	<meta name="theme-color" content={themeColor} />
</svelte:head>
