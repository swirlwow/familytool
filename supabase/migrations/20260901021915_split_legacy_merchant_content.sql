-- Older ledger entries stored both the merchant and purchase description in
-- the merchant field as "merchant@description". Preserve every meaningful
-- value while moving the description to its dedicated column.
update public.ledger_entries
set
  merchant = nullif(btrim(split_part(merchant, '@', 1)), ''),
  consumption_content = coalesce(
    nullif(btrim(substring(merchant from position('@' in merchant) + 1)), ''),
    consumption_content
  )
where merchant like '%@%'
  and nullif(btrim(consumption_content), '') is null;
