import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { supabase } from "../lib/supabase";

export default function Index() {
  const [status, setStatus] = useState("Conectando ao Supabase...");

  useEffect(() => {
    supabase
      .from("cities")
      .select("name, state_code")
      .order("name")
      .then(({ data, error }) => {
        setStatus(
          error
            ? `Falha ao conectar: ${error.message}`
            : `Conectado — ${data.length} cidade(s): ${data
                .map((city) => `${city.name}/${city.state_code}`)
                .join(", ")}`,
        );
      });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vez Staff</Text>
      <Text style={styles.subtitle}>App do estabelecimento</Text>
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  title: { fontSize: 18, fontWeight: "600" },
  subtitle: { fontSize: 13, color: "#666" },
  status: { fontSize: 13, textAlign: "center", marginTop: 12 },
});
