import {expect,it} from 'vitest';
import {PARTY_OCCASIONS,classificationTags,inferPartyOccasion,partyCategoryLabel,partyDiscoveryLabels,partySearchTags,validatePartyClassificationForm} from '@/lib/party-occasions';
it('supports Pet Party creation without requiring human age or audience fields',()=>{
 expect(PARTY_OCCASIONS).toContain('Pet Party');const form=new FormData();Object.entries({classificationVersion:'1',occasion:'Pet Party',eventMonth:'11',eventYear:'2026'}).forEach(([key,value])=>form.set(key,value));expect(validatePartyClassificationForm(form)).toBeNull();
 const tags=classificationTags({category:'Pet Party',month:'11',age:'',audience:'',graduation:'',holiday:''});expect(tags).toContain('petparty');expect(partyCategoryLabel('petparty')).toBe('Pet Party');expect(partyDiscoveryLabels(tags,'Milo’s party')).toContain('Pet Party');
});
it.each(['Pet birthday','Dog party','Puppy birthday','Cat party','Barkday'])('finds pet celebrations from %s',query=>{
 expect(partySearchTags(query)).toContain('petparty');expect(inferPartyOccasion([],query)).toBe('Pet Party');
});
