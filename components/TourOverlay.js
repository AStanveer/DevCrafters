import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Modal,
    Animated,
    Easing,
    PanResponder,
} from 'react-native';
import { usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

const TourOverlay = () => {
    const pathname = usePathname();
    const [visible, setVisible] = useState(false);
    const [hasSeenTour, setHasSeenTour] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const [userId, setUserId] = useState(null);
    const [isCompleting, setIsCompleting] = useState(false); // Add this flag
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const pan = useRef(new Animated.ValueXY()).current;

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
            },
            onPanResponderMove: Animated.event(
                [null, { dx: pan.x, dy: pan.y }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: () => {
                pan.extractOffset();
            },
        })
    ).current;

    // Tour steps remain the same...
    const tourSteps = [
        {
            id: 'welcome',
            title: 'Welcome to Pillora!',
            description: 'Your personal medication assistant',
            position: { x: width / 2 - 140, y: 150 },
        },
        {
            id: 'active_meds',
            title: 'Active Medications',
            description: 'Track your current medicines',
            position: { x: 100, y: 200 },
        },
        {
            id: 'scan_medicine',
            title: 'Scan Medicine',
            description: 'Identify pills with camera',
            position: { x: 90, y: 380 },
        },
        {
            id: 'reminders',
            title: 'Set Reminders',
            description: 'Never miss a dose',
            position: { x: width - 115, y: 380 },
        },
        {
            id: 'find_pharmacies',
            title: 'Find Pharmacies',
            description: 'Locate nearby stores',
            position: { x: 90, y: 500 },
        },
        {
            id: 'analytics',
            title: 'Analytics',
            description: 'View your medication insights',
            position: { x: width - 115, y: 500 },
        },
    ];

    const startPulse = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    useEffect(() => {
        const checkTourStatus = async (user) => {
            if (!user) return;
            try {
                setUserId(user.id);
                const userTourKey = `@tour_seen_${user.id}`;
                const tourSeen = await AsyncStorage.getItem(userTourKey);
                console.log('Tour status:', tourSeen);
                setHasSeenTour(tourSeen === 'true');
            } catch (e) {
                console.error("Failed to check tour status", e);
                setHasSeenTour(false);
            }
        };
        
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) checkTourStatus(user);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                checkTourStatus(session.user);
            } else if (event === 'SIGNED_OUT') {
                setUserId(null);
                setHasSeenTour(true);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        // Auto-start tour when on home screen
        console.log('useEffect check:', { 
            pathname, 
            visible, 
            hasSeenTour, 
            userId, 
            isCompleting 
        });
        
        if (pathname === '/home' && !visible && !hasSeenTour && userId && !isCompleting) {
            console.log('Starting auto tour');
            setTimeout(() => {
                setVisible(true);
                setCurrentStep(0);
                startPulse();
            }, 1500);
        }
    }, [pathname, visible, hasSeenTour, userId, isCompleting]);

    const markTourAsSeen = async () => {
        if (!userId) return;
        
        try {
            console.log('Marking tour as seen for user:', userId);
            const userTourKey = `@tour_seen_${userId}`;
            await AsyncStorage.setItem(userTourKey, 'true');
            setHasSeenTour(true);
            console.log('Tour marked as seen successfully');
        } catch (e) {
            console.error("Failed to save tour status.", e);
        }
    };

    const completeTour = async () => {
        console.log('Completing tour');
        setIsCompleting(true);
        pulseAnim.stopAnimation();
        await markTourAsSeen();
        setVisible(false);
        setCurrentStep(0);
        
        // Reset the completion flag after a delay
        setTimeout(() => {
            setIsCompleting(false);
        }, 1000);
    };

    const nextStep = () => {
        console.log('Next step called. Current step:', currentStep, 'Total steps:', tourSteps.length);
        
        if (currentStep < tourSteps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            // This is the last step
            completeTour();
        }
    };

    const previousStep = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const showTour = () => {
        console.log('Manual tour start');
        setCurrentStep(0);
        setVisible(true);
        startPulse();
    };

    const hideTour = () => {
        console.log('Hiding tour manually');
        pulseAnim.stopAnimation();
        setVisible(false);
        markTourAsSeen();
    };

    // Only show on home screen
    if (pathname !== '/home') {
        return null;
    }

    if (!visible) {
        return (
            <>
                <Animated.View
                    style={[
                        styles.floatingStartButtonContainer,
                        { transform: [{ translateX: pan.x }, { translateY: pan.y }] }
                    ]}
                    {...panResponder.panHandlers}
                >
                    <TouchableOpacity style={styles.floatingStartButton} onPress={showTour} activeOpacity={0.8}>
                        <Text style={styles.floatingStartText}>🎯 Start Tour</Text>
                    </TouchableOpacity>
                </Animated.View>
            </>
        );
    }

    const currentStepData = tourSteps[currentStep];

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={completeTour} // Changed to completeTour
        >
            <View style={styles.modalContainer}>
                <View style={styles.overlay} />

                <TouchableOpacity style={styles.skipButton} onPress={completeTour}>
                    <Text style={styles.skipText}>Skip Tour</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.restartButton} onPress={() => {
                    pulseAnim.stopAnimation();
                    setCurrentStep(0);
                    startPulse();
                }}>
                    <Text style={styles.restartText}>Restart</Text>
                </TouchableOpacity>

                {currentStepData.id !== 'welcome' && (
                    <Animated.View
                        style={[
                            styles.highlightContainer,
                            {
                                left: currentStepData.position.x - 50,
                                top: currentStepData.position.y - 50,
                                transform: [{ scale: pulseAnim }],
                            }
                        ]}
                    >
                        <View style={styles.outerGlow} />
                        <View style={styles.middleRing} />
                        <View style={styles.innerCircle} />
                    </Animated.View>
                )}

                <View style={[
                    styles.tooltip,
                    {
                        top: currentStepData.id === 'welcome'
                            ? currentStepData.position.y + 80
                            : currentStepData.position.y + 100
                    }
                ]}>
                    <Text style={styles.tooltipTitle}>{currentStepData.title}</Text>
                    <Text style={styles.tooltipDescription}>
                        {currentStepData.description}
                    </Text>
                    <View style={styles.tooltipFooter}>
                        <Text style={styles.stepCounter}>
                            {currentStep + 1} / {tourSteps.length}
                        </Text>
                        <View style={styles.tooltipButtons}>
                            {currentStep > 0 && (
                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={previousStep}
                                >
                                    <Text style={styles.secondaryButtonText}>Back</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={nextStep}
                            >
                                <Text style={styles.primaryButtonText}>
                                    {currentStep === tourSteps.length - 1 ? 'Got it!' : 'Next'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

// Styles remain the same...
const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    highlightContainer: {
        position: 'absolute',
        width: 120,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
    },
    outerGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
    },
    middleRing: {
        position: 'absolute',
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'rgba(14, 165, 233, 0.3)',
        borderWidth: 2,
        borderColor: 'rgba(14, 165, 233, 0.5)',
    },
    innerCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(14, 165, 233, 0.4)',
        borderWidth: 3,
        borderColor: '#0EA5E9',
        borderStyle: 'dashed',
    },
    tooltip: {
        position: 'absolute',
        left: 20,
        right: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    tooltipTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0F172A',
        marginBottom: 8,
    },
    tooltipDescription: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 20,
        marginBottom: 20,
    },
    tooltipFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    stepCounter: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    tooltipButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    primaryButton: {
        backgroundColor: '#48b8ecff',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        minWidth: 80,
        alignItems: 'center',
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
    },
    secondaryButton: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        minWidth: 80,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#475569',
        fontWeight: '600',
        fontSize: 14,
    },
    skipButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 5,
        zIndex: 50,
    },
    skipText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '700',
    },
    restartButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 5,
        zIndex: 50,
    },
    restartText: {
        color: '#0EA5E9',
        fontSize: 14,
        fontWeight: '700',
    },
    floatingStartButtonContainer: {
        position: 'absolute',
        bottom: 180,
        right: 20,
        zIndex: 9999,
    },
    floatingStartButton: {
        backgroundColor: '#0EA5E9',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    floatingStartText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default TourOverlay;