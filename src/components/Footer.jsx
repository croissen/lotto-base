import styled from 'styled-components';

export default function Footer() {
  return (
    <Wrap>
      <Inner>
        <NoticeBox>
          <Title>[면책 공지 · 필독]</Title>
          <p>
            본 사이트(로또베이스)는 통계 기반 번호 생성 서비스를 제공하며,{' '}
            <Strong>당첨을 절대 보장하지 않습니다.</Strong> 생성된 번호는
            참고용이며 당첨 결과에 대한 책임을 지지 않습니다.
          </p>
          <p>
            로또는 <Strong>만 19세 이상</Strong>만 구매 가능하며
            건전하게 즐겨주세요. 도박 문제로 어려움을 겪고 계시다면{' '}
            <Strong>한국 도박문제 예방치유원 1336</Strong>으로 연락해주세요.
          </p>
        </NoticeBox>
        <Meta>
          <Brand>[로또베이스]</Brand> · 번호 생성 서비스 · 당첨 보장 없음
        </Meta>
        <Copy>© 2026 로또베이스. All Rights Reserved.</Copy>
      </Inner>
    </Wrap>
  );
}

const Wrap = styled.footer`
  margin: 40px 0 24px;
`;

const Inner = styled.div`
  max-width: 920px;
  margin: 0 auto;
  padding: 0 20px;
  @media (max-width: 480px) {
    padding: 0 12px;
  }
`;

const NoticeBox = styled.div`
  background: rgba(255, 92, 92, 0.04);
  border: 1px solid rgba(255, 92, 92, 0.25);
  border-radius: 12px;
  padding: 16px 20px;
  font-size: 13px;
  line-height: 1.7;
  color: ${(p) => p.theme.textMuted};
  p {
    margin: 0 0 8px;
  }
  p:last-child {
    margin-bottom: 0;
  }
`;

const Title = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${(p) => p.theme.danger};
  margin-bottom: 8px;
`;

const Strong = styled.strong`
  color: ${(p) => p.theme.danger};
  font-weight: 700;
`;

const Meta = styled.div`
  margin-top: 18px;
  font-size: 12px;
  color: ${(p) => p.theme.textMuted};
  text-align: center;
`;

const Brand = styled.span`
  color: ${(p) => p.theme.accent};
  font-weight: 700;
`;

const Copy = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: ${(p) => p.theme.textMuted};
  text-align: center;
`;
