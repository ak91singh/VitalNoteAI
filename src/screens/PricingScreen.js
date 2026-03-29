import React from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PricingScreen() {
    const theme = useTheme();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.emoji}>🚀</Text>
                <Text variant="headlineSmall" style={styles.title}>
                    Subscribe to Pro
                </Text>
                <Text variant="bodyMedium" style={styles.body}>
                    To subscribe or manage your plan, visit agentryinc.com
                </Text>
                <Button
                    mode="contained"
                    buttonColor={theme.colors.primary}
                    contentStyle={styles.buttonContent}
                    style={styles.button}
                    onPress={() =>
                        Linking.openURL('https://www.agentryinc.com/subscribe').catch(() => {})
                    }
                >
                    Visit agentryinc.com →
                </Button>
                <Text style={styles.note}>
                    Questions? support@vitalnote.ai
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FA',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emoji: {
        fontSize: 56,
        marginBottom: 16,
    },
    title: {
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
        color: '#1565C0',
    },
    body: {
        textAlign: 'center',
        color: '#555',
        lineHeight: 24,
        marginBottom: 32,
    },
    button: {
        borderRadius: 12,
        width: '100%',
    },
    buttonContent: {
        height: 52,
    },
    note: {
        marginTop: 20,
        color: '#999',
        fontSize: 13,
        textAlign: 'center',
    },
});
