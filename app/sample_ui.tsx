import { Box, HStack, Pressable, Text } from '@gluestack-ui/themed';
import { Play } from 'lucide-react-native';
import React from 'react';

const NeumorphicButton = ({
  children,
  onPress,
  isCircle = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  isCircle?: boolean;
}) => {
  const baseSize = isCircle ? 72 : undefined;

  return (
    <Pressable onPress={onPress}>
      {/* Outer (어두운 그림자) */}
      <Box
        sx={{
          bg: '#e5e7eb',
          w: baseSize,
          h: baseSize,
          borderRadius: isCircle ? 999 : 999,
          shadowColor: '#1f2937',
          shadowOffset: { width: 8, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 14,
          elevation: 16,
        }}
      >
        {/* Inner (하이라이트 그림자) */}
        <Box
          sx={{
            bg: '#e5e7eb',
            w: baseSize,
            h: baseSize,
            borderRadius: isCircle ? 999 : 999,
            shadowColor: '#ffffff',
            shadowOffset: { width: -8, height: -8 },
            shadowOpacity: 0.9,
            shadowRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
            px: isCircle ? 0 : '$10',
            py: isCircle ? 0 : '$4',
          }}
        >
          {children}
        </Box>
      </Box>
    </Pressable>
  );
};

export default function ExampleScreen() {
  return (
    <Box flex={1} bg="#111827" justifyContent="center" alignItems="center">
      <HStack space="md" alignItems="center">
        {/* Play 버튼 */}
        <NeumorphicButton isCircle>
          <Play size={36} color="#374151" strokeWidth={3} />
        </NeumorphicButton>

        {/* Order Now 버튼 */}
        <NeumorphicButton>
          <Text
            fontSize="$xl"
            fontWeight="$bold"
            color="#374151"
            textAlign="center"
          >
            Order Now
          </Text>
        </NeumorphicButton>
      </HStack>
    </Box>
  );
}