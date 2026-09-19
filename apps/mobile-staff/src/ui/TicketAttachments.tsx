import { mono, sans } from "@vez/mobile-kit/theme";
import { formatBytes } from "@vez/supabase/attachments";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { addTicketAttachment, useTicketAttachments } from "../data/support";
import { color } from "../theme/tokens";
import { Card, OutlineButton, SectionLabel } from "./primitives";

export function TicketAttachments({ ticketId }: { ticketId: string }) {
  const query = useTicketAttachments(ticketId);
  const rows = query.data ?? [];
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick() {
    setError(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled) return;
    setUploading(true);
    const result = await addTicketAttachment(ticketId, picked.assets[0]!, rows);
    setUploading(false);
    if (!result.ok) return setError(result.message);
    query.reload();
  }

  return (
    <View style={{ gap: 10 }}>
      <SectionLabel>Anexos</SectionLabel>
      {query.error ? (
        <Text style={sans(13, 500, { color: color.danger })}>{query.error}</Text>
      ) : rows.length > 0 ? (
        <Card>
          {rows.map((item, index) => (
            <Pressable
              accessibilityRole="link"
              disabled={!item.url}
              key={item.id}
              onPress={() => item.url && void Linking.openURL(item.url)}
              style={{
                padding: 14,
                borderBottomWidth: index === rows.length - 1 ? 0 : 1,
                borderBottomColor: color.lineSoft,
                gap: 3,
              }}
            >
              <Text numberOfLines={1} style={sans(13.5, 600)}>
                {item.fileName}
              </Text>
              <Text style={mono(9.5, 500, { color: color.muted })}>
                {formatBytes(item.sizeBytes)} · {item.fromStaff ? "EQUIPE VEZ" : "LOJA"}
                {item.url ? "" : " · link indisponível"}
              </Text>
            </Pressable>
          ))}
        </Card>
      ) : (
        <Text style={sans(12.5, 400, { lh: 1.4, color: color.muted })}>
          Nenhum arquivo anexado.
        </Text>
      )}
      {error ? <Text style={sans(13, 500, { color: color.danger })}>{error}</Text> : null}
      <OutlineButton
        label={uploading ? "Anexando…" : "Anexar imagem ou PDF"}
        height={42}
        onPress={uploading ? undefined : pick}
      />
    </View>
  );
}
