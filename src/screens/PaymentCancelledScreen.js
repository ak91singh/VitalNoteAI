import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Card, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PaymentCancelledScreen({ navigation }) {
    const theme = useTheme();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>

                <Text style={styles.emoji}>👋</Text>
                <Text variant="headlineMedium" style={styles.title}>
                    No problem!
                </Text>
                <Text variant="bodyLarge" style={styles.subtitle}>
                    Your free notes are still available.{'\n'}
                    You can upgrade whenever you're ready.
                </Text>

                <Card style={styles.card} mode="outlined">
                    <Card.Content>
                        <Text variant="titleSmall" style={{ fontWeight: 'bold', marginBottom: 8, color: '#1565C0' }}>
                            Free tier includes:
                        </Text>
                        <Text variant="bodySmall" style={styles.bullet}>✓  3 SOAP notes per day</Text>
                        <Text variant="bodySmall" style={styles.bullet}>✓  All specialties</Text>
                        <Text variant="bodySmall" style={styles.bullet}>✓  PDF export</Text>
                        <Text variant="bodySmall" style={styles.bullet}>✓  Medical codes (CPT/ICD-10)</Text>
                    </Card.Content>
                </Card>

                <Button
                    mode="contained"
                    icon="stethoscope"
                    onPress={() => navigation.replace('Dashboard')}
                    style={styles.btn}
                    contentStyle={{ height: 52 }}
                    buttonColor={theme.colors.primary}
                >
                    Continue with Free Plan
                </Button>

                <Button
                    mode="outlined"
                    icon="star"
                    onPress={() => navigation.replace('Pricing')}
                    style={[styles.btn, { marginTop: 0 }]}
                    contentStyle={{ height: 52 }}
                >
                    View Plans Again
                </Button>

                <Text style={styles.support}>
                    Need help? support@vitalnote.ai
                </Text>

            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    content: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
    emoji: { fontSize: 64, marginBottom: 16 },
    title: { fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    subtitle: { color: '#555', textAlign: 'center', marginBottom: 24, lineHeight: 24 },
    card: { width: '100%', backgroundColor: 'white', marginBottom: 28 },
    bullet: { marginBottom: 6, color: '#444', lineHeight: 22 },
    btn: { width: '100%', borderRadius: 12, marginBottom: 12 },
    support: { textAlign: 'center', color: '#aaa', fontSize: 13, marginTop: 16 },
});
