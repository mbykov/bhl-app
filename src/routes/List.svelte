<script>

  import RecordLine from './RecordLine.svelte';

  const log = console.log

  let { records } = $props();
  log('_DATA', records)

</script>

<div class="pb-4">
  List::::
</div>

<div class="records">
  <ul class="record-list">
    {#each records as record}
      <!-- <li>{record.title}</li> -->
      <RecordLine item={record} />
    {:else}
        <!-- this block renders when records.length === 0 -->
        <p>loading...</p>
    {/each}
  </ul>
</div>
