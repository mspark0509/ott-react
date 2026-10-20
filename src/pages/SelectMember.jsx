import React, { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const familys = ["아빠", "엄마", "아들", "딸"];
export const SelectMember = () => {
  const navigate = useNavigate();
  // zustand 상태변수
  const { onSetMember } = useAuthStore();
  const [selectMember, setSelectMember] = useState(null);
  // 확인 번튼 클릭시 실행할 메서드
  const handleConfirm=()=>{
    if(!selectMember) return
    onSetMember(selectMember);
    navigate("/");
  }
  return (
    <section className='sub-page pt-25 flex item-center justify-center'>
      <div className="inner">
        <div className='border p-10 m-50'>
          <h2 className="section-title text-3xl font-bold">멤버선택</h2>
          <p>사용할 사용자를 선택하세요</p>
          <div>
            {familys.map((member) => (
              <button onClick={() => setSelectMember(member)}
                className={`w-full p-4 border mb-2
              ${selectMember === member ? "border-blue-500 bg-blue-100" : ""}`
                }>{member}</button>
            ))}
          </div>
          <div className='flex gap-4'>
            <button className='bg-blue-600 text-white p-3 flex-1'
            onClick={handleConfirm}>확인</button>
            <button className='bg-blue-600 text-white p-3 flex-1'>건너뛰기</button>
          </div>
        </div>
      </div>
    </section>
  )
}
