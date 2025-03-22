import styled from '@emotion/styled'


// Styled Components
const Card = styled.div`
  background: #2a2a2a;
  border-radius: 8px;
  padding: 16px;
  margin: 12px 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const BestMoveCard = styled(Card)`
  border-left: 4px solid #4CAF50;
`;

const ReasoningCard = styled(Card)`
  border-left: 4px solid #2196F3;
`;

const CardTitle = styled.h2`
  margin: 0 0 8px 0;
  font-size: 1.1rem;
  color: #ffffff;
`;

const MoveText = styled.div`
  font-size: 1.2rem;
  font-weight: bold;
  color: #4CAF50;
`;

const ReasoningText = styled.p`
  margin: 0;
  color: #e0e0e0;
`;

export { Card, BestMoveCard, ReasoningCard, CardTitle, MoveText, ReasoningText };
