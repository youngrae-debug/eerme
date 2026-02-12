import { Box, HStack, Pressable, ScrollView, Text, VStack } from '@gluestack-ui/themed';
import { Bell, Download, Heart, Play, Plus, Search, Settings, Share2 } from 'lucide-react-native';
import React, { useState } from 'react';

const NeumorphicButton = ({
  children,
  onPress,
  isCircle = false,
  size = 'md',
  variant = 'default',
}: {
  children: React.ReactNode;
  onPress?: () => void;
  isCircle?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'pressed';
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const sizes = {
    sm: 48,
    md: 64,
    lg: 80,
  };

  const baseSize = isCircle ? sizes[size] : undefined;
  const isPressedState = variant === 'pressed' || isPressed;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
    >
      <Box
        sx={{
          bg: '#ecf0f3',
          w: baseSize,
          h: baseSize,
          borderRadius: isCircle ? 999 : 20,
          shadowColor: isPressedState ? '#ffffff' : '#bcc3cf',
          shadowOffset: isPressedState ? { width: -4, height: -4 } : { width: 10, height: 10 },
          shadowOpacity: isPressedState ? 0.9 : 0.6,
          shadowRadius: isPressedState ? 8 : 16,
          elevation: isPressedState ? 4 : 12,
        }}
      >
        <Box
          sx={{
            bg: '#ecf0f3',
            w: baseSize,
            h: baseSize,
            borderRadius: isCircle ? 999 : 20,
            shadowColor: isPressedState ? '#bcc3cf' : '#ffffff',
            shadowOffset: isPressedState ? { width: 4, height: 4 } : { width: -10, height: -10 },
            shadowOpacity: isPressedState ? 0.6 : 0.9,
            shadowRadius: isPressedState ? 8 : 16,
            justifyContent: 'center',
            alignItems: 'center',
            px: isCircle ? 0 : '$8',
            py: isCircle ? 0 : '$3',
          }}
        >
          {children}
        </Box>
      </Box>
    </Pressable>
  );
};

const NeumorphicCard = ({ children }: { children: React.ReactNode }) => {
  return (
    <Box
      sx={{
        bg: '#ecf0f3',
        borderRadius: 24,
        shadowColor: '#bcc3cf',
        shadowOffset: { width: 10, height: 10 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
        elevation: 12,
        p: '$6',
        mx: '$4',
        mb: '$6',
      }}
    >
      <Box
        sx={{
          bg: '#ecf0f3',
          borderRadius: 24,
          shadowColor: '#ffffff',
          shadowOffset: { width: -10, height: -10 },
          shadowOpacity: 0.9,
          shadowRadius: 20,
          p: '$4',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default function ExampleScreen() {
  return (
    <Box flex={1} bg="#ecf0f3">
      <ScrollView showsVerticalScrollIndicator={false}>
        <VStack space="2xl" py="$8">
          {/* 헤더 */}
          <VStack space="xs" px="$6">
            <Text fontSize="$3xl" fontWeight="$bold" color="#4a5568">
              Neumorphic Design
            </Text>
            <Text fontSize="$md" color="#718096">
              Modern soft UI components
            </Text>
          </VStack>

          {/* 원형 아이콘 버튼들 */}
          <VStack space="md" px="$6">
            <Text fontSize="$lg" fontWeight="$semibold" color="#4a5568" mb="$2">
              Icon Buttons
            </Text>
            <HStack space="lg" flexWrap="wrap">
              <NeumorphicButton isCircle size="md">
                <Play size={28} color="#6366f1" fill="#6366f1" />
              </NeumorphicButton>
              <NeumorphicButton isCircle size="md">
                <Heart size={28} color="#ef4444" />
              </NeumorphicButton>
              <NeumorphicButton isCircle size="md">
                <Share2 size={28} color="#8b5cf6" />
              </NeumorphicButton>
              <NeumorphicButton isCircle size="md">
                <Download size={28} color="#10b981" />
              </NeumorphicButton>
            </HStack>
          </VStack>

          {/* 다양한 크기 */}
          <VStack space="md" px="$6">
            <Text fontSize="$lg" fontWeight="$semibold" color="#4a5568" mb="$2">
              Different Sizes
            </Text>
            <HStack space="lg" alignItems="center">
              <NeumorphicButton isCircle size="sm">
                <Bell size={20} color="#f59e0b" />
              </NeumorphicButton>
              <NeumorphicButton isCircle size="md">
                <Search size={28} color="#3b82f6" />
              </NeumorphicButton>
              <NeumorphicButton isCircle size="lg">
                <Plus size={36} color="#ec4899" />
              </NeumorphicButton>
            </HStack>
          </VStack>

          {/* 텍스트 버튼들 */}
          <VStack space="md" px="$6">
            <Text fontSize="$lg" fontWeight="$semibold" color="#4a5568" mb="$2">
              Text Buttons
            </Text>
            <VStack space="md">
              <NeumorphicButton>
                <Text fontSize="$lg" fontWeight="$bold" color="#4a5568">
                  Get Started
                </Text>
              </NeumorphicButton>
              <NeumorphicButton>
                <HStack space="sm" alignItems="center">
                  <Play size={20} color="#6366f1" fill="#6366f1" />
                  <Text fontSize="$lg" fontWeight="$bold" color="#4a5568">
                    Watch Demo
                  </Text>
                </HStack>
              </NeumorphicButton>
            </VStack>
          </VStack>

          {/* Pressed 상태 */}
          <VStack space="md" px="$6">
            <Text fontSize="$lg" fontWeight="$semibold" color="#4a5568" mb="$2">
              Pressed State
            </Text>
            <HStack space="lg">
              <NeumorphicButton isCircle size="md" variant="pressed">
                <Settings size={28} color="#6b7280" />
              </NeumorphicButton>
              <NeumorphicButton variant="pressed">
                <Text fontSize="$lg" fontWeight="$bold" color="#6b7280">
                  Active
                </Text>
              </NeumorphicButton>
            </HStack>
          </VStack>

          {/* 카드 컴포넌트 */}
          <VStack space="md" mt="$4">
            <Text fontSize="$lg" fontWeight="$semibold" color="#4a5568" mb="$2" px="$6">
              Card Component
            </Text>
            <NeumorphicCard>
              <VStack space="md">
                <HStack justifyContent="space-between" alignItems="center">
                  <Text fontSize="$xl" fontWeight="$bold" color="#4a5568">
                    Premium Plan
                  </Text>
                  <Box
                    bg="#6366f1"
                    px="$3"
                    py="$1"
                    borderRadius={12}
                  >
                    <Text fontSize="$sm" fontWeight="$semibold" color="#ffffff">
                      Popular
                    </Text>
                  </Box>
                </HStack>
                <Text fontSize="$3xl" fontWeight="$bold" color="#4a5568">
                  $29<Text fontSize="$md" color="#718096">/month</Text>
                </Text>
                <VStack space="xs">
                  <Text fontSize="$sm" color="#718096">✓ Unlimited projects</Text>
                  <Text fontSize="$sm" color="#718096">✓ Priority support</Text>
                  <Text fontSize="$sm" color="#718096">✓ Advanced analytics</Text>
                </VStack>
              </VStack>
            </NeumorphicCard>

            <NeumorphicCard>
              <VStack space="md" alignItems="center">
                <Box
                  bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                  w={80}
                  h={80}
                  borderRadius={40}
                  justifyContent="center"
                  alignItems="center"
                >
                  <Heart size={40} color="#ffffff" fill="#ffffff" />
                </Box>
                <Text fontSize="$xl" fontWeight="$bold" color="#4a5568" textAlign="center">
                  Loved by designers
                </Text>
                <Text fontSize="$sm" color="#718096" textAlign="center">
                  Beautiful neumorphic UI components that make your app stand out
                </Text>
              </VStack>
            </NeumorphicCard>
          </VStack>

          <Box h="$8" />
        </VStack>
      </ScrollView>
    </Box>
  );
}