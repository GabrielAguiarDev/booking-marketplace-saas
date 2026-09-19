import { mono, sans } from "@vez/mobile-kit/theme";
import { formatBytes } from "@vez/supabase/attachments";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { addTicketAttachment, useTicketAttachments } from "../data/support";
import { color } from "../theme/tokens";
import { Card, Label, OutlineButton } from "./primitives";

export function TicketAttachments({ ticketId, writable }: { ticketId: string; writable: boolean }) {
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
      <Label>ANEXOS</Label>
      {query.error ? (
        <Text style={sans(13, 500, { color: color.coral })}>{query.error}</Text>
      ) : rows.length > 0 ? (
        <Card radius={16}>
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
                {formatBytes(item.sizeBytes)} · {item.fromStaff ? "EQUIPE VEZ" : "VOCÊ"}
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
      {error ? <Text style={sans(13, 500, { color: color.coral })}>{error}</Text> : null}
      {writable ? (
        <OutlineButton
          label={uploading ? "Anexando…" : "Anexar imagem ou PDF"}
          height={42}
          onPress={uploading ? undefined : pick}
        />
      ) : null}
    </View>
  );
}
