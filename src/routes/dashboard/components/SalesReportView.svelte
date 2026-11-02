<script lang="ts">
  /**
   * SalesReportView — the Sales Report tab. Since v3 it renders the Sales
   * Book (docs/designs/sales-book-v3.md). This wrapper keeps the `salesReport`
   * view key, `sr_*` bookmarks and the Metrics → Sales Report deep links
   * (`salesReportPrefill`) working unchanged.
   */
  import SalesBook from './sales/SalesBook.svelte';
</script>

<SalesBook />
