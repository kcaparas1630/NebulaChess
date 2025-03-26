// STYLED COMPONENTS
import styled from '@emotion/styled';

// Base card with improved styling
const Card = styled.div`
  background: #333333;
  border-radius: 10px;
  padding: 16px;
  margin: 16px 0;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  overflow: hidden;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
  }
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(to bottom, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%);
    pointer-events: none;
  }
`;

// Best move card with distinctive styling
const BestMoveCard = styled(Card)`
  border-left: 4px solid #4CAF50;
  background: linear-gradient(to right, #2a3a2a, #333333);
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 30px;
    height: 30px;
    background: radial-gradient(circle at top right, rgba(76, 175, 80, 0.2), transparent 70%);
  }
`;

// Alternative move card with distinctive styling
const AlternativeMoveCard = styled(Card)`
  border-left: 4px solid #2196F3;
  background: linear-gradient(to right, #2a2a3a, #333333);
  padding: 12px 16px;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 25px;
    height: 25px;
    background: radial-gradient(circle at top right, rgba(33, 150, 243, 0.15), transparent 70%);
  }
`;

// Improved title styling
const CardTitle = styled.h2`
  margin: 0 0 12px 0;
  font-size: 1.1rem;
  color: #ffffff;
  font-weight: 600;
  display: flex;
  align-items: center;
  
  &::before {
    content: '';
    display: inline-block;
    width: 6px;
    height: 6px;
    background-color: #4CAF50;
    border-radius: 50%;
    margin-right: 8px;
  }
`;

// Move text with chess piece icon support
const MoveText = styled.div`
  font-size: 1.3rem;
  font-weight: bold;
  color: #4CAF50;
  display: flex;
  align-items: center;
  letter-spacing: 0.5px;
  
  &.alternative {
    font-size: 1.1rem;
    color: #2196F3;
  }
`;

// Badge component for evaluation scores
const EvalBadge = styled.span<{ positive: boolean }>`
  background-color: ${props => props.positive ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'};
  color: ${props => props.positive ? '#4CAF50' : '#F44336'};
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 0.9rem;
  margin-left: 10px;
  font-weight: normal;
`;


// Container for the sidebar
const SidebarContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  background-color: #252525;
  background-image: 
    linear-gradient(to bottom, rgba(30, 30, 30, 0.8) 0%, rgba(30, 30, 30, 0) 100%),
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.03) 0px, rgba(255, 255, 255, 0.03) 1px, transparent 1px, transparent 10px);
`;

// Header component for the sidebar
const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

// Title for the sidebar
const SidebarTitle = styled.h1`
  font-size: 1.25rem;
  color: #ffffff;
  margin: 0;
  font-weight: 600;
`;

// ChessPiece icon component
const ChessPiece = styled.span`
  margin-right: 8px;
  font-size: 1.4em;
  line-height: 1;
`;

export { 
  Card, 
  BestMoveCard, 
  CardTitle, 
  MoveText, 
  AlternativeMoveCard,
  EvalBadge,
  SidebarContainer,
  SidebarHeader,
  SidebarTitle,
  ChessPiece
};
