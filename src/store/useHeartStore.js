import { create } from "zustand";
import { auth, db } from "../firebase/firebase";
import { useAuthStore } from "./useAuthStore";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export const useHeartStore = create((set, get) => ({
    // 찜리스트 저장 배열
    hearts: [],
    // 찜리스트를 배열에 저장할 메서드
    onAddHearts: async (item) => {
        const user = auth.currentUser;
        if (!user) return;
        const currentMember = useAuthStore.getState().currentMember;
        if (!currentMember) return;
        try {
            const haertItem = {
                id: item.id,
                // item안에 title 항목이 있는지 체크해서 있으면 title사용하고 없으면 name을 사용하기
                // why? movie는 제목을 title로 가지고있고,tv는 제목을 name으로 가지고있기때문
                title: "title" in item ? item.title : item.name,
                poster_path: item.poster_path,
            }
            // firebase에 저장하기
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                // 이전에 저장된 자료를 가져와서 
                const prevHeart = userDoc.data()?.familyMembers?.[currentMember]?.likes || []
                // 내가 찜한 항목이랑 일치하지 않는것만 추가로 넣기
                const filtered = prevHeart.filter((h) => h.id !== item.id)
                // 추가로 넣기
                const newHeart = [haertItem, ...filtered]
                // firebase에 자료 업데이트하기
                await updateDoc(userDocRef, { [`familyMembers.${currentMember}.likes`]: newHeart })
                // zustand 변수에도 자료 업데이트하기
                set({ hearts: newHeart })
            }
        }
        catch (err) {
            console.log("찜오류", err.message)
        }
    },
    onLoadHearts: async () => {
        const user = auth.currentUser;
        if (!user) return;
        const currentMember = useAuthStore.getState().currentMember;
        if (!currentMember) return;
        try {
            // firebase에 사용자계정
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const likes = userDoc.data()?.familyMembers?.[currentMember]?.likes || []
                set({ hearts: likes })
            }
        }
        catch (err) {
            console.log("찜리스트 불러오기 오류", err.message)
        }
    },
    // 토글
    onToggleHearts:async(item)=>{
        // 현재 찜한 콘텐츠인지 확인
        const hearted=get().onIsHeart(item.id);
        if(hearted){
            // 찜한 상태라면 삭제
            await get().onRemoveHearts(item.id);
        } else{
            // 찜하지 않은 상태라면 추가
            await get().onAddHearts(item);
        }
    },
    // 삭제
    onRemoveHearts: async (id) => {
        const user = auth.currentUser;
        if (!user) return;
        const currentMember = useAuthStore.getState().currentMember;
        if (!currentMember) return;
        try {
            // firebase에 사용자계정
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const likes = userDoc.data()?.familyMembers?.[currentMember]?.likes || []
                const filtered = likes.filter((h) => h.id !== id);
                await updateDoc(userDocRef,{[`familyMembers.${currentMember}.likes`]:filtered})
                set({ hearts: filtered })
                alert("찜삭제");
            }
        }
        catch (err) {
            console.log("찜삭제 오류", err.message)
        }
    },
    
    // 하트의 상태를 변경해줄 메서드
    onIsHeart: (id) => {
        // some 데이터가 배열의 객체로 있는지를 체크해서 true/false를 반환한다
        return get().hearts.some((h) => h.id === id)
    },
}));