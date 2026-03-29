import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';

const NUM_BARS = 6;

const AudioVisualizer = ({ isRecording, metering }) => {
    // metering is typically -160 (silent) to 0 (loud)
    // Normalize to 0 - 1 range
    // Practical range is often -60db to 0db for speech

    const theme = useTheme();
    const animations = useRef([...Array(NUM_BARS)].map(() => new Animated.Value(5))).current;

    useEffect(() => {
        if (!isRecording) {
            // Reset to flat
            animations.forEach(anim => {
                Animated.timing(anim, {
                    toValue: 5,
                    duration: 200,
                    useNativeDriver: false
                }).start();
            });
            return;
        }

        // Calculate generic loudness factor (0.0 to 1.0)
        let normalized = 0;
        if (metering !== undefined) {
            // Example: -160 is silence, 0 is max. 
            // Let's take -50 as floor for visualization visibility
            const floor = -50;
            if (metering > floor) {
                normalized = (metering - floor) / Math.abs(floor);
            }
        }

        // Animate each bar
        animations.forEach((anim, index) => {
            // Add some randomness per bar so they don't move in perfect unison
            const randomFactor = Math.random() * 0.5 + 0.5;
            const targetHeight = 10 + (normalized * 50 * randomFactor);

            Animated.timing(anim, {
                toValue: targetHeight,
                duration: 100, // Quick update
                useNativeDriver: false
            }).start();
        });

    }, [metering, isRecording]);

    return (
        <View style={styles.container}>
            {animations.map((anim, index) => (
                <Animated.View
                    key={index}
                    style={[
                        styles.bar,
                        {
                            height: anim,
                            backgroundColor: isRecording ? theme.colors.error : '#ccc' // Use theme, red/error for recording
                        }
                    ]}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 60,
        gap: 6
    },
    bar: {
        width: 8,
        borderRadius: 4,
    }
});

export default AudioVisualizer;
