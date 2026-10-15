function buildComponents(event) {
  if (event.status === 'closed') return [];

  // Hàng 1: 4 Nút Role
  const roleRow = new ActionRowBuilder().addComponents(
    ...MAIN_ROLE_BUTTONS.map((b) => {
      const customId = b.kind === 'dps' ? ID.DPS_OPEN : `${ID.ROLE_PREFIX}${b.key}`;
      return new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(b.label)
        .setEmoji(roleEmojiComponent(event.guild_id, b.icons) || b.emoji)
        .setStyle(ButtonStyle.Primary);
    }),
  );

  // Hàng 2: Nút trạng thái & tiện ích
  const statusRow = new ActionRowBuilder().addComponents(
    ...EXTRA_STATUSES.map((s) =>
      new ButtonBuilder()
        .setCustomId(`${ID.STATUS_PREFIX}${s.key}`)
        .setLabel(s.label)
        .setEmoji(s.emoji)
        .setStyle(ButtonStyle.Secondary),
    ),
    new ButtonBuilder()
      .setCustomId(ID.LEAVE)
      .setLabel('Withdraw')
      .setEmoji('🚪')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(SUG.OPEN)
      .setLabel('Suggest')
      .setEmoji('💡')
      .setStyle(ButtonStyle.Secondary),
  );

  // Hàng 3: Select Menu hiện TRỰC TIẾP trên bảng Event
  const jobRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(ID.JOB_SELECT)
      .setPlaceholder('Chọn Vũ khí / Build của bạn...')
      .addOptions(
        JOBS.map((j) => {
          const option = { label: `${j.name} (${j.code})`, value: j.code };
          const custom = jobEmojiComponent(event.guild_id, j.code);
          if (custom) option.emoji = custom;
          return option;
        }),
      ),
  );

  // Trả về cả 3 hàng hiển thị công khai trên tin nhắn
  return [roleRow, statusRow, jobRow];
}
